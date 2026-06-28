'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n-context';
import supabase from '@/lib/supabaseClient';
import { clampRankLevel, getRankTier } from '@/lib/ranks';
import { CNY_TO_EUR, CNY_TO_USD, getSellQuote, formatMoney, formatCompactNum } from '@/lib/sell-offer';
import { getDiceState } from '@/lib/dice';
import { useCurrency } from '@/lib/currency-context';
import { useSound } from '@/lib/sound-context';
import {
  WALLET_DECORATIONS,
  TRADE_SLOT_ORDER,
  SQUEEZE_SLOT_ORDER,
  appendWalletDecoration,
  computeRelayLevel,
  getEmojiTitle,
  getWalletMarketDelta,
  MARKET_EVENT_TYPE_LIFE,
  MARKET_EVENT_TYPE_NFTJI,
} from '@/lib/wallet-decorations';
const getDiff = (lvl) => {
  if (lvl >= 70) return 5;
  if (lvl >= 40) return 4;
  if (lvl >= 20) return 3;
  if (lvl >= 8)  return 2;
  return 1;
};
const getTimeLimit = (lvl) => Math.max(1500, 6000 - lvl * 55);
const getRewardMult = (lvl) => 1 + Math.floor(lvl / 10) * 0.5;
const clampLevel = (lvl) => clampRankLevel(lvl);
const PRE_GAME_LINES = [
  'BRACE YOURSELF',
  'WAKE THE ABACUS',
  'NOODLE THE MATRIX',
  'CRUNCH THE VOID',
  'MELT THE CALCULATOR',
  'PATCH THE TIMELINE',
  'FEED THE MAINFRAME',
  "DON'T TRUST THE DIGITS",
];
const REVIVE_COST_EUR = 1;
const REVIVE_COST_USD = REVIVE_COST_EUR * (CNY_TO_USD / CNY_TO_EUR);
const REVIVE_COST_CNY = REVIVE_COST_EUR / CNY_TO_EUR;
const PROBLEM_CACHE_VERSION = 3;
const DAILY_MINE_BASE = 100;
const MINING_NFTJI_EMOJI_CACHE = new Map();
const TRADE_NFTJI_LEVEL_FIELDS = {
  lucky50: 'lucky_50_level',
  lucky100: 'lucky_100_level',
  lucky500: 'lucky_500_level',
  lucky1000: 'lucky_1000_level',
};
const ANON_NFTJI_SLOTS = [
  ...TRADE_SLOT_ORDER.map((slot) => ({ key: `anon-trade-${slot.key}`, emoji: slot.emoji, source: 'trade', placeholder: true })),
  { key: 'anon-genesis', emoji: WALLET_DECORATIONS.marketGenesis, source: 'wallet', placeholder: true },
  { key: 'anon-relay', emoji: WALLET_DECORATIONS.relay, source: 'relay', placeholder: true },
  ...SQUEEZE_SLOT_ORDER.map((slot) => ({ key: `anon-${slot.key}`, emoji: slot.emoji, source: 'squeeze', placeholder: true })),
  { key: 'anon-mining', emoji: '⬡', source: 'mining', placeholder: true },
];

async function getMiningNftjiEmoji(blockKey) {
  if (!blockKey) return null;
  if (MINING_NFTJI_EMOJI_CACHE.has(blockKey)) return MINING_NFTJI_EMOJI_CACHE.get(blockKey);
  const { data } = await supabase
    .from('mm3_mining_blocks')
    .select('emoji')
    .eq('block_key', blockKey)
    .maybeSingle();
  const emoji = data?.emoji || '⬡';
  MINING_NFTJI_EMOJI_CACHE.set(blockKey, emoji);
  return emoji;
}

function buildTrainingNftjis(progress, squeezeNftji, miningEmoji) {
  const walletEmojis = Array.isArray(progress?.wallet_emojis) ? progress.wallet_emojis : [];
  const owned = new Set(walletEmojis);
  const roster = [];

  // 1. Trade slots — fixed order, placeholder if not owned (mirrors Trading slot display)
  for (const slot of TRADE_SLOT_ORDER) {
    const isOwned = owned.has(slot.emoji);
    roster.push({
      key: `trade-${slot.key}`,
      emoji: slot.emoji,
      level: isOwned && slot.key !== 'revive' ? Math.max(0, Number(progress?.[TRADE_NFTJI_LEVEL_FIELDS[slot.key]] ?? 0)) : 0,
      source: 'trade',
      placeholder: !isOwned,
    });
  }

  // 2. Genesis + Relay — fixed order, placeholder if not owned
  const hasGenesis = owned.has(WALLET_DECORATIONS.marketGenesis);
  roster.push({ key: 'genesis', emoji: WALLET_DECORATIONS.marketGenesis, level: 0, source: 'wallet', placeholder: !hasGenesis });

  const hasRelay = owned.has(WALLET_DECORATIONS.relay);
  const execCount = Number(progress?.relay_exec_count) || 0;
  roster.push({
    key: 'relay',
    emoji: WALLET_DECORATIONS.relay,
    level: hasRelay ? computeRelayLevel(execCount, execCount) : 0,
    source: 'relay',
    placeholder: !hasRelay,
  });

  // 3. Squeeze slots — fixed order, placeholder if not equipped
  for (const slot of SQUEEZE_SLOT_ORDER) {
    const isAttack = slot.key === 'sq-atk';
    const equipped = isAttack ? 'attack' : 'defense';
    const isOwned = squeezeNftji?.equipped === equipped && Number(isAttack ? squeezeNftji?.attack_level : squeezeNftji?.defense_level) >= 0;
    const rawLevel = isAttack ? squeezeNftji?.attack_level : squeezeNftji?.defense_level;
    roster.push({
      key: slot.key,
      emoji: slot.emoji,
      level: isOwned ? Math.max(0, Number(rawLevel) || 0) : 0,
      source: 'squeeze',
      placeholder: !isOwned,
    });
  }

  // 4. Mining NFTJI — always one slot
  const miningKey = progress?.mining_nftji_key || null;
  roster.push({
    key: miningKey ? `mining-${miningKey}` : 'mining-empty',
    emoji: miningKey ? (miningEmoji || '⬡') : '⬡',
    level: miningKey ? Math.max(0, Number(progress?.mining_nftji_levels?.[miningKey] ?? 0)) : 0,
    source: 'mining',
    blockKey: miningKey || null,
    placeholder: !miningKey,
  });

  return roster;
}

const PROBLEM_FAMILY_LABELS = {
  en: {
    arithmetic: 'Arithmetic',
    operator_fix: 'Operator',
    digit_fix: 'Digit',
    powers: 'Powers',
    sequence: 'Sequence',
    modulo: 'Modulo',
    logic: 'Logic',
    fractions: 'Fractions',
    primes: 'Primes',
    geometry: 'Geometry',
    percentage: 'Percent',
    algebra: 'Algebra',
    definition: 'Definition',
  },
  es: {
    arithmetic: 'Aritmética',
    operator_fix: 'Operador',
    digit_fix: 'Dígito',
    powers: 'Potencias',
    sequence: 'Secuencia',
    modulo: 'Módulo',
    logic: 'Lógica',
    fractions: 'Fracciones',
    primes: 'Primos',
    geometry: 'Geometría',
    percentage: 'Porcentaje',
    algebra: 'Álgebra',
    definition: 'Definición',
  },
};

function getProblemFamilyLabel(problem, lang) {
  const rawType = problem?.problem_type || problem?.type || 'arithmetic';
  const type = String(rawType).toLowerCase();
  const dictionary = String(lang || 'en').startsWith('es')
    ? PROBLEM_FAMILY_LABELS.es
    : PROBLEM_FAMILY_LABELS.en;
  return dictionary[type] || dictionary.arithmetic;
}

function getUtcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { start, end };
}

/* ── In-game question translations ── */
const GT = {
  en: {
    seq: 'Sequence', fib: 'Fibonacci',
    prime: 'PRIME', notPrime: 'NOT PRIME', composite: 'COMPOSITE', odd: 'ODD',
    yes: 'YES', no: 'NO', truth: 'TRUE', falsehood: 'FALSE', maybe: 'MAYBE', both: 'BOTH', unknown: 'UNKNOWN', none: 'NONE', equal: 'EQUAL', nil: 'NULL',
    and: 'AND', or: 'OR', not: 'NOT',
    isNPrime: n => `Is ${n} prime?`,
    nextPrime: n => `Next prime after ${n}?`,
    smallFactor: n => `Smallest prime factor of ${n}?`,
    distFactors: n => `Distinct prime factors of ${n}?`,
    sumPrimesLt: n => `Sum of primes < ${n}?`,
    nthPrime: n => `${n}th prime =`,
    twinPrimes: (a, b) => `Are ${a} and ${b} twin primes?`,
    greatest: 'Greatest?', least: 'Least?', middle: 'Middle?', smallest: 'Smallest?',
    rectArea: (w, h) => `Area of rectangle: ${w} × ${h} =`,
    rectPerim: (w, h) => `Perimeter of rectangle ${w} × ${h} =`,
    sqArea: s => `Area of square, side ${s} =`,
    sqPerim: s => `Perimeter of square, side ${s} =`,
    triArea: (b, h) => `Triangle area: base ${b}, height ${h} =`,
    hypot: (a, b) => `Right triangle legs ${a}, ${b}: hypotenuse =`,
    leg: (c, a) => `Right triangle hypotenuse ${c}, leg ${a}: other leg =`,
    ngon: n => `Sum of interior angles of a ${n}-gon =`,
    cuboid: (l, w, h) => `Volume of cuboid ${l}×${w}×${h} =`,
    circArea: r => `Circle area (π≈3), radius ${r} =`,
    circPerim: r => `Circle circumference (π≈3), radius ${r} =`,
    regAngle: n => `Each interior angle of regular ${n}-gon =`,
    trapArea: (a, b, h) => `Trapezoid: parallel sides ${a} and ${b}, height ${h}: area =`,
    rectDiag: (a, b) => `Diagonal of rectangle ${a} × ${b} =`,
    cubeSurf: s => `Surface area of cube, side ${s} =`,
    pctOf: (p, b) => `${p}% of ${b} =`,
    whatPct: (x, y) => `${x} is what % of ${y}?`,
    pctChange: (v, p, d) => `${v} after ${p}% ${d} =`,
    inc: 'increase', dec: 'decrease',
    pctRise: (p, a) => `After ${p}% rise price is ${a}. Original =`,
    averageOf: (a, b, c) => `Average of ${a}, ${b}, ${c} =`,
    clueDigitSum: (s, d) => `I am a two-digit number. My digits add to ${s}, and my tens digit is ${d} more than my ones digit. What number am I?`,
    clueLcm: (a, b, n) => `Smallest positive number divisible by ${a} and ${b}, then plus ${n} =`,
    clueConsecutive: (s, d) => `Two consecutive numbers add to ${s}. What is the larger one?`,
    clueTriple: n => `If you add ${n} to me, you get triple me. What number am I?`,
    clueRemainder: (m, r1, d, r2) => `A number leaves remainder ${r1} when divided by ${m}, and remainder ${r2} when divided by ${d}. Smallest such number =`,
    storyCrates: (a, b, c) => `A miner opens ${a} crates with ${b} chips each and finds ${c} extra chips. Total chips =`,
    storyRows: (a, b, c) => `A retro board has ${a} rows of ${b} blocks and ${c} glitch blocks turn off. Lit blocks =`,
    storySteps: (a, b, c) => `A robot climbs ${a} steps, slips ${b}, then climbs ${c} more. Final height =`,
    storyGarden: (l, w) => `A square neon garden has perimeter ${4 * l}. Another rectangle is ${l} by ${w}. How much larger is the rectangle area?`,
    storyTickets: (a, b, c) => `${a} tickets cost ${b} each, then a fixed fee of ${c} is added. Total cost =`,
  },
  es: {
    seq: 'Secuencia', fib: 'Fibonacci',
    prime: 'PRIMO', notPrime: 'NO PRIMO', composite: 'COMPUESTO', odd: 'IMPAR',
    yes: 'SÍ', no: 'NO', truth: 'VERDADERO', falsehood: 'FALSO', maybe: 'QUIZÁ', both: 'AMBAS', unknown: 'DESCONOCIDO', none: 'NINGUNO', equal: 'IGUAL', nil: 'NULO',
    and: 'Y', or: 'O', not: 'NO',
    isNPrime: n => `¿Es ${n} primo?`,
    nextPrime: n => `¿Siguiente primo después de ${n}?`,
    smallFactor: n => `¿Factor primo menor de ${n}?`,
    distFactors: n => `¿Factores primos distintos de ${n}?`,
    sumPrimesLt: n => `¿Suma de primos < ${n}?`,
    nthPrime: n => `Primo nº${n} =`,
    twinPrimes: (a, b) => `¿Son ${a} y ${b} primos gemelos?`,
    greatest: '¿El mayor?', least: '¿El menor?', middle: '¿El del medio?', smallest: '¿El más pequeño?',
    rectArea: (w, h) => `Área del rectángulo: ${w} × ${h} =`,
    rectPerim: (w, h) => `Perímetro del rectángulo ${w} × ${h} =`,
    sqArea: s => `Área del cuadrado, lado ${s} =`,
    sqPerim: s => `Perímetro del cuadrado, lado ${s} =`,
    triArea: (b, h) => `Área del triángulo: base ${b}, altura ${h} =`,
    hypot: (a, b) => `Triángulo rect. catetos ${a}, ${b}: hipotenusa =`,
    leg: (c, a) => `Triángulo rect. hip. ${c}, cat. ${a}: otro cateto =`,
    ngon: n => `Suma ángulos interiores de un ${n}-ágono =`,
    cuboid: (l, w, h) => `Volumen del paralelepípedo ${l}×${w}×${h} =`,
    circArea: r => `Área del círculo (π≈3), radio ${r} =`,
    circPerim: r => `Circunferencia (π≈3), radio ${r} =`,
    regAngle: n => `Ángulo interior del ${n}-ágono regular =`,
    trapArea: (a, b, h) => `Trapecio: bases ${a} y ${b}, altura ${h}: área =`,
    rectDiag: (a, b) => `Diagonal del rectángulo ${a} × ${b} =`,
    cubeSurf: s => `Superficie del cubo, lado ${s} =`,
    pctOf: (p, b) => `${p}% de ${b} =`,
    whatPct: (x, y) => `${x} ¿es qué % de ${y}?`,
    pctChange: (v, p, d) => `${v} tras ${d} del ${p}% =`,
    inc: 'aumento', dec: 'bajada',
    pctRise: (p, a) => `Tras subida del ${p}%, precio es ${a}. ¿Original?`,
    averageOf: (a, b, c) => `Media de ${a}, ${b}, ${c} =`,
    clueDigitSum: (s, d) => `Soy un número de dos cifras. Mis cifras suman ${s} y la decena es ${d} mayor que la unidad. ¿Qué número soy?`,
    clueLcm: (a, b, n) => `El menor número positivo divisible por ${a} y ${b}, más ${n}, es =`,
    clueConsecutive: (s, d) => `Dos números consecutivos suman ${s}. ¿Cuál es el mayor?`,
    clueTriple: n => `Si me sumas ${n}, obtienes el triple de mí. ¿Qué número soy?`,
    clueRemainder: (m, r1, d, r2) => `Un número deja resto ${r1} al dividirlo entre ${m}, y resto ${r2} al dividirlo entre ${d}. El menor que cumple eso es =`,
    storyCrates: (a, b, c) => `Un minero abre ${a} cajas con ${b} fichas cada una y encuentra ${c} fichas extra. ¿Total de fichas?`,
    storyRows: (a, b, c) => `Un tablero retro tiene ${a} filas de ${b} bloques y ${c} bloques glitch se apagan. ¿Bloques encendidos?`,
    storySteps: (a, b, c) => `Un robot sube ${a} escalones, resbala ${b} y luego sube ${c} más. ¿Altura final?`,
    storyGarden: (l, w) => `Un jardín cuadrado de neón tiene perímetro ${4 * l}. Otro rectángulo mide ${l} por ${w}. ¿Cuánto mayor es el área del rectángulo?`,
    storyTickets: (a, b, c) => `${a} tickets cuestan ${b} cada uno y luego se añade una tasa fija de ${c}. ¿Coste total?`,
  },
};

const DB_DEFINITION_ES = {
  'What is a number that can be divided by 1 and itself only?': {
    q: '¿Cómo se llama un número entero mayor que 1 cuyos únicos divisores positivos son 1 y él mismo?',
    a: 'Número primo',
    choices: ['Número primo', 'Número compuesto', 'Número par', 'Número impar'],
  },
  'The sum of all angles in a triangle equals...': {
    q: 'La suma de los ángulos interiores de un triángulo es...',
    a: '180 grados',
    choices: ['180 grados', '90 grados', '360 grados', '270 grados'],
  },
  'I have four equal sides and four equal angles. What am I?': {
    q: 'Tengo cuatro lados iguales y cuatro ángulos iguales. ¿Qué soy?',
    a: 'Cuadrado',
    choices: ['Cuadrado', 'Rectángulo', 'Triángulo', 'Círculo'],
  },
  'What do you call a number with no fractional part?': {
    q: '¿Cómo se llama un número sin parte fraccionaria?',
    a: 'Entero',
    choices: ['Entero', 'Decimal', 'Fracción', 'Primo'],
  },
  'If you cut a pizza into 2 equal slices, each slice is what fraction?': {
    q: 'Si cortas una pizza en 2 porciones iguales, ¿qué fracción es cada porción?',
    a: '1/2',
    choices: ['1/2', '1/3', '1/4', '2/3'],
  },
  'A triangle with all three sides equal is called...': {
    q: 'Un triángulo con sus tres lados iguales se llama...',
    a: 'Equilátero',
    choices: ['Equilátero', 'Escaleno', 'Isósceles', 'Rectángulo'],
  },
  'What is the result of multiplying any number by zero?': {
    q: '¿Cuál es el resultado de multiplicar cualquier número por cero?',
    a: '0',
    choices: ['0', '1', 'El propio número', 'Indefinido'],
  },
  'How many sides does a hexagon have?': {
    q: '¿Cuántos lados tiene un hexágono?',
    a: '6',
    choices: ['6', '5', '7', '8'],
  },
  'What is the name for the answer to an addition problem?': {
    q: '¿Cómo se llama el resultado de una suma?',
    a: 'Suma',
    choices: ['Suma', 'Producto', 'Diferencia', 'Cociente'],
  },
  'What is the name for the answer to a multiplication problem?': {
    q: '¿Cómo se llama el resultado de una multiplicación?',
    a: 'Producto',
    choices: ['Producto', 'Suma', 'Diferencia', 'Cociente'],
  },
  'How many degrees are in a right angle?': {
    q: '¿Cuántos grados tiene un ángulo recto?',
    a: '90',
    choices: ['90', '180', '45', '60'],
  },
  'What symbol means "is not equal to"?': {
    q: '¿Qué símbolo significa "no es igual a"?',
    a: '≠',
    choices: ['≠', '≈', '≤', '±'],
  },
  'The distance around the outside of a shape is called...': {
    q: 'La distancia alrededor del exterior de una figura se llama...',
    a: 'Perímetro',
    choices: ['Perímetro', 'Área', 'Volumen', 'Diámetro'],
  },
  'A number divisible by 2 is called...': {
    q: 'Un número divisible por 2 se llama...',
    a: 'Par',
    choices: ['Par', 'Impar', 'Primo', 'Compuesto'],
  },
  'I am doubled when you read me forward or backward. I am 11. What property do I have?': {
    q: 'Se lee igual hacia delante y hacia atrás. Soy 22. ¿Qué propiedad tengo?',
    a: 'Palíndromo',
    choices: ['Palíndromo', 'Primo', 'Cuadrado', 'Fibonacci'],
  },
  'What do you call the longest side of a right triangle?': {
    q: '¿Cómo se llama el lado más largo de un triángulo rectángulo?',
    a: 'Hipotenusa',
    choices: ['Hipotenusa', 'Adyacente', 'Opuesto', 'Perpendicular'],
  },
  'A whole number greater than 1 that is NOT prime is called...': {
    q: 'Un número entero mayor que 1 que NO es primo se llama...',
    a: 'Compuesto',
    choices: ['Compuesto', 'Entero', 'Racional', 'Negativo'],
  },
  'Two fractions that represent the same value are called...': {
    q: 'Dos fracciones que representan el mismo valor se llaman...',
    a: 'Fracciones equivalentes',
    choices: ['Fracciones equivalentes', 'Números mixtos', 'Fracciones impropias', 'Fracciones unitarias'],
  },
  'What is a number called when it appears in its own multiplication table result? e.g. 4 = 2²': {
    q: '¿Cómo se llama un entero que es igual a otro entero multiplicado por sí mismo? Ej: 4 = 2²',
    a: 'Cuadrado perfecto',
    choices: ['Cuadrado perfecto', 'Primo', 'Factorial', 'Recíproco'],
  },
  'In the fraction 3/4, the number 4 is called...': {
    q: 'En la fracción 3/4, el número 4 se llama...',
    a: 'Denominador',
    choices: ['Denominador', 'Numerador', 'Cociente', 'Resto'],
  },
  'What is 50% expressed as a decimal?': {
    q: '¿Cuánto es 50% expresado como decimal?',
    a: '0.5',
    choices: ['0.5', '5', '0.05', '50'],
  },
  'A line that passes through the centre of a circle from edge to edge is called...': {
    q: 'Una línea que pasa por el centro de un círculo de borde a borde se llama...',
    a: 'Diámetro',
    choices: ['Diámetro', 'Radio', 'Cuerda', 'Arco'],
  },
  'The number you divide by in a division problem is called...': {
    q: 'El número por el que divides en una división se llama...',
    a: 'Divisor',
    choices: ['Divisor', 'Dividendo', 'Cociente', 'Resto'],
  },
  'What name is given to the sequence 1, 1, 2, 3, 5, 8, 13...?': {
    q: '¿Qué nombre recibe la secuencia 1, 1, 2, 3, 5, 8, 13...?',
    a: 'Sucesión de Fibonacci',
    choices: ['Sucesión de Fibonacci', 'Secuencia de primos', 'Secuencia geométrica', 'Secuencia armónica'],
  },
  'Pi (π) is approximately equal to...': {
    q: 'Pi (π) es aproximadamente igual a...',
    a: '3.14159',
    choices: ['3.14159', '3.12345', '2.71828', '1.41421'],
  },
  'A quadrilateral with exactly one pair of parallel sides is called...': {
    q: 'Un cuadrilátero con exactamente un par de lados paralelos se llama...',
    a: 'Trapecio',
    choices: ['Trapecio', 'Rombo', 'Paralelogramo', 'Cometa'],
  },
  'What is the mathematical term for the middle value in a sorted list?': {
    q: '¿Cuál es el término matemático para el valor central de una lista ordenada?',
    a: 'Mediana',
    choices: ['Mediana', 'Media', 'Moda', 'Rango'],
  },
  'The most frequently occurring value in a data set is the...': {
    q: 'El valor que aparece con más frecuencia en un conjunto de datos es la...',
    a: 'Moda',
    choices: ['Moda', 'Media', 'Mediana', 'Promedio'],
  },
  'What is the name for the sum of a list divided by the count of items?': {
    q: '¿Cómo se llama la suma de una lista dividida por el número de elementos?',
    a: 'Media',
    choices: ['Media', 'Moda', 'Mediana', 'Varianza'],
  },
  'A ratio that compares a number to 100 is called...': {
    q: 'Una razón que compara un número con 100 se llama...',
    a: 'Porcentaje',
    choices: ['Porcentaje', 'Fracción', 'Decimal', 'Proporción'],
  },
  'Two lines that never meet and stay the same distance apart are...': {
    q: 'Dos líneas que nunca se cruzan y mantienen la misma distancia son...',
    a: 'Paralelas',
    choices: ['Paralelas', 'Perpendiculares', 'Tangentes', 'Secantes'],
  },
  'What do you call an angle greater than 90° but less than 180°?': {
    q: '¿Cómo se llama un ángulo mayor que 90° pero menor que 180°?',
    a: 'Obtuso',
    choices: ['Obtuso', 'Agudo', 'Reflejo', 'Llano'],
  },
  'The number e ≈ 2.718 is called...': {
    q: 'El número e ≈ 2.718 se llama...',
    a: 'Número de Euler',
    choices: ['Número de Euler', 'Pi', 'Razón áurea', 'Unidad imaginaria'],
  },
  'If a² + b² = c², this is known as...': {
    q: 'Si a² + b² = c², esto se conoce como...',
    a: 'Teorema de Pitágoras',
    choices: ['Teorema de Pitágoras', 'Teorema binomial', 'Último teorema de Fermat', 'Regla de Pascal'],
  },
  'What is the term for the distance from the centre of a circle to its edge?': {
    q: '¿Cómo se llama la distancia desde el centro de un círculo hasta su borde?',
    a: 'Radio',
    choices: ['Radio', 'Diámetro', 'Cuerda', 'Circunferencia'],
  },
  'I have no corners and my perimeter is called circumference. What am I?': {
    q: 'No tengo esquinas y mi perímetro se llama circunferencia. ¿Qué soy?',
    a: 'Círculo',
    choices: ['Círculo', 'Óvalo', 'Esfera', 'Elipse'],
  },
  'How many faces does a cube have?': {
    q: '¿Cuántas caras tiene un cubo?',
    a: '6',
    choices: ['6', '4', '8', '12'],
  },
  'A statement that is always true regardless of the values is called...': {
    q: 'Una proposición que siempre es verdadera sin importar los valores se llama...',
    a: 'Tautología',
    choices: ['Tautología', 'Paradoja', 'Axioma', 'Contradicción'],
  },
  'The derivative measures...': {
    q: 'La derivada mide...',
    a: 'Tasa de cambio',
    choices: ['Tasa de cambio', 'Área bajo la curva', 'Distancia total', 'Valor medio'],
  },
  'An integral is the inverse of...': {
    q: 'Una integral es la inversa de...',
    a: 'Una derivada',
    choices: ['Una derivada', 'Un límite', 'Una función', 'Una ecuación'],
  },
  'The limit of a function describes...': {
    q: 'El límite de una función describe...',
    a: 'A qué valor se acerca la función',
    choices: ['A qué valor se acerca la función', 'El valor máximo', 'El valor mínimo', 'La pendiente'],
  },
  'The golden ratio φ ≈ 1.618 satisfies which equation?': {
    q: '¿Qué ecuación satisface la razón áurea φ ≈ 1.618?',
    a: 'φ² = φ + 1',
    choices: ['φ² = φ + 1', 'φ² = 2φ', 'φ = √2', 'φ³ = φ + 2'],
  },
  'In modular arithmetic, 17 mod 5 equals...': {
    q: 'En aritmética modular, 17 mod 5 es...',
    a: '2',
    choices: ['2', '3', '1', '4'],
  },
  'The number of permutations of n distinct items is...': {
    q: 'El número de permutaciones de n elementos distintos es...',
    a: 'n!',
    choices: ['n!', 'n²', '2n', 'n(n-1)'],
  },
  'What is the name for a number that equals the sum of its proper divisors? (e.g., 6 = 1+2+3)': {
    q: '¿Cómo se llama un número que es igual a la suma de sus divisores propios? (ej.: 6 = 1+2+3)',
    a: 'Número perfecto',
    choices: ['Número perfecto', 'Número primo', 'Número abundante', 'Número de Fibonacci'],
  },
  'The imaginary unit i is defined as...': {
    q: 'La unidad imaginaria i se define como...',
    a: '√(-1)',
    choices: ['√(-1)', '√2', '-1', '1/i'],
  },
  'An equation of the form ax² + bx + c = 0 is called...': {
    q: 'Una ecuación de la forma ax² + bx + c = 0 se llama...',
    a: 'Ecuación cuadrática',
    choices: ['Ecuación cuadrática', 'Ecuación lineal', 'Ecuación cúbica', 'Ecuación exponencial'],
  },
  'What is the name for the coefficient of the highest power in a polynomial?': {
    q: '¿Cómo se llama el coeficiente de la potencia más alta de un polinomio?',
    a: 'Coeficiente principal',
    choices: ['Coeficiente principal', 'Término constante', 'Discriminante', 'Asíntota'],
  },
  'A function f is bijective if it is both...': {
    q: 'Una función f es biyectiva si es a la vez...',
    a: 'Inyectiva y sobreyectiva',
    choices: ['Inyectiva y sobreyectiva', 'Impar y par', 'Continua y discreta', 'Lineal y polinómica'],
  },
  'The discriminant b²-4ac tells us how many...': {
    q: 'El discriminante b²-4ac nos dice cuántas...',
    a: 'Raíces reales tiene una cuadrática',
    choices: ['Raíces reales tiene una cuadrática', 'Factores tiene un polinomio', 'Términos tiene una serie', 'Soluciones tiene un límite'],
  },
  'Two integers with GCD = 1 are called...': {
    q: 'Dos enteros con MCD = 1 se llaman...',
    a: 'Coprimos',
    choices: ['Coprimos', 'Primos gemelos', 'Equivalentes', 'Factorizados'],
  },
  'The sum of interior angles of any convex polygon with n sides is...': {
    q: 'La suma de ángulos interiores de cualquier polígono convexo de n lados es...',
    a: '(n-2)×180°',
    choices: ['(n-2)×180°', 'n×90°', '(n-1)×180°', 'n×180°'],
  },
  'Euler\'s identity e^(iπ) + 1 = 0 connects how many fundamental constants?': {
    q: '¿Cuántas constantes fundamentales conecta la identidad de Euler e^(iπ) + 1 = 0?',
    a: '5',
    choices: ['5', '3', '4', '6'],
  },
  'The set of all rational and irrational numbers together forms...': {
    q: 'El conjunto de todos los números racionales e irracionales forma...',
    a: 'Los números reales',
    choices: ['Los números reales', 'Los enteros', 'Los números complejos', 'Los naturales'],
  },
  'A statement that is true but whose proof uses itself is called...': {
    q: 'Una prueba o argumento que asume lo que intenta demostrar se llama...',
    a: 'Razonamiento circular',
    choices: ['Razonamiento circular', 'Prueba inductiva', 'Axioma', 'Conjetura'],
  },
  'The Fundamental Theorem of Calculus links differentiation to...': {
    q: 'El Teorema Fundamental del Cálculo vincula la diferenciación con...',
    a: 'Integración',
    choices: ['Integración', 'Factorización', 'Permutación', 'Iteración'],
  },
  'A prime number that remains prime when its digits are reversed is called...': {
    q: 'Un número primo cuyas cifras invertidas forman un primo distinto se llama...',
    a: 'Emirp',
    choices: ['Emirp', 'Primo de Mersenne', 'Primo gemelo', 'Primo seguro'],
  },
  'Fermat\'s Last Theorem states that x^n + y^n = z^n has no integer solutions for n...': {
    q: 'El Último Teorema de Fermat dice que x^n + y^n = z^n no tiene soluciones enteras positivas para n...',
    a: 'Mayor que 2',
    choices: ['Mayor que 2', 'Mayor que 1', 'Igual a 2', 'Menor que 2'],
  },
  'In set theory, the cardinality of the power set of a set with n elements is...': {
    q: 'En teoría de conjuntos, la cardinalidad del conjunto potencia de un conjunto con n elementos es...',
    a: '2^n',
    choices: ['2^n', 'n!', 'n²', '2n'],
  },
  'A Mersenne prime has the form...': {
    q: 'Un primo de Mersenne tiene la forma...',
    a: '2^p - 1',
    choices: ['2^p - 1', 'p^2 + 1', '2p + 1', 'p! - 1'],
  },
  'The halting problem proves that some problems are...': {
    q: 'El problema de la parada demuestra que algunos problemas son...',
    a: 'Indecidibles',
    choices: ['Indecidibles', 'NP-hard', 'Insolubles numéricamente', 'Exponenciales'],
  },
  'Which theorem guarantees a root between f(a) and f(b) if f is continuous?': {
    q: '¿Qué teorema garantiza una raíz entre a y b si f es continua y f(a), f(b) tienen signos opuestos?',
    a: 'Teorema del valor intermedio',
    choices: ['Teorema del valor intermedio', 'Teorema del valor medio', 'Teorema de Rolle', 'Teorema del encaje'],
  },
  'A polyhedron with a square base and four triangular faces is called...': {
    q: 'Un poliedro con base cuadrada y cuatro caras triangulares se llama...',
    a: 'Pirámide cuadrada',
    choices: ['Pirámide cuadrada', 'Tetraedro', 'Prisma', 'Cuboide'],
  },
  'The volume of a sphere with radius r is...': {
    q: 'El volumen de una esfera de radio r es...',
    a: '(4/3)πr³',
    choices: ['(4/3)πr³', '4πr²', 'πr²h', '2πr³'],
  },
  'What is the smallest two-digit prime number?': {
    q: '¿Cuál es el número primo de dos cifras más pequeño?',
    a: '11',
    choices: ['11', '12', '13', '17'],
  },
  'What is the only even prime number?': {
    q: '¿Cuál es el único número primo par?',
    a: '2',
    choices: ['2', '4', '6', '1'],
  },
  'The product of a number and its reciprocal is always...': {
    q: 'El producto de un número por su recíproco siempre es...',
    a: '1',
    choices: ['1', '0', 'El propio número', '2'],
  },
  'A number is divisible by 9 if...': {
    q: 'Un número es divisible por 9 si...',
    a: 'La suma de sus cifras es divisible por 9',
    choices: ['La suma de sus cifras es divisible por 9', 'Termina en 9', 'Es impar', 'Es mayor que 9'],
  },
  'If "All cats are animals" is true and "Mia is a cat", then...': {
    q: 'Si "todos los gatos son animales" es verdadero y "Mia es un gato", entonces...',
    a: 'Mia es un animal',
    choices: ['Mia es un animal', 'Todos los animales son gatos', 'Mia no es un animal', 'No se puede concluir nada'],
  },
  'The contrapositive of "If P then Q" is...': {
    q: 'La contrapositiva de "si P entonces Q" es...',
    a: 'Si NO Q entonces NO P',
    choices: ['Si NO Q entonces NO P', 'Si Q entonces P', 'Si NO P entonces NO Q', 'Si P entonces NO Q'],
  },
  'Gödel\'s incompleteness theorem states that any consistent system...': {
    q: 'El teorema de incompletitud de Gödel dice que cualquier sistema formal consistente y suficientemente expresivo...',
    a: 'Contiene verdades que no puede demostrar',
    choices: ['Contiene verdades que no puede demostrar', 'Tiene axiomas infinitos', 'Siempre es completo', 'No puede manejar enteros'],
  },
};

const DB_DEFINITION_EN_OVERRIDES = {
  'What is a number that can be divided by 1 and itself only?': {
    q: 'What is a whole number greater than 1 whose only positive divisors are 1 and itself?',
    a: 'Prime number',
    choices: ['Prime number', 'Composite number', 'Even number', 'Odd number'],
  },
  'The sum of all angles in a triangle equals...': {
    q: 'The sum of the interior angles of a triangle equals...',
    a: '180 degrees',
    choices: ['180 degrees', '90 degrees', '360 degrees', '270 degrees'],
  },
  'I am doubled when you read me forward or backward. I am 11. What property do I have?': {
    q: 'I read the same forward and backward. I am 22. What property do I have?',
    a: 'Palindrome',
    choices: ['Palindrome', 'Prime', 'Square', 'Fibonacci'],
  },
  'What is a number called when it appears in its own multiplication table result? e.g. 4 = 2²': {
    q: 'What is a whole number called when it equals an integer multiplied by itself? e.g. 4 = 2²',
    a: 'Perfect square',
    choices: ['Perfect square', 'Prime', 'Factorial', 'Reciprocal'],
  },
  'A statement that is true but whose proof uses itself is called...': {
    q: 'A proof or argument that assumes what it is trying to prove is called...',
    a: 'Circular reasoning',
    choices: ['Circular reasoning', 'Inductive proof', 'Axiom', 'Conjecture'],
  },
  'A prime number that remains prime when its digits are reversed is called...': {
    q: 'A prime number whose reversed digits form a different prime is called...',
    a: 'Emirp',
    choices: ['Emirp', 'Mersenne prime', 'Twin prime', 'Safe prime'],
  },
  'Fermat\'s Last Theorem states that x^n + y^n = z^n has no integer solutions for n...': {
    q: 'Fermat\'s Last Theorem states that x^n + y^n = z^n has no positive integer solutions for n...',
    a: 'Greater than 2',
    choices: ['Greater than 2', 'Greater than 1', 'Equal to 2', 'Less than 2'],
  },
  'Which theorem guarantees a root between f(a) and f(b) if f is continuous?': {
    q: 'Which theorem guarantees a root between a and b if f is continuous and f(a), f(b) have opposite signs?',
    a: 'Intermediate Value Theorem',
    choices: ['Intermediate Value Theorem', 'Mean Value Theorem', 'Rolle\'s Theorem', 'Squeeze Theorem'],
  },
  'Gödel\'s incompleteness theorem states that any consistent system...': {
    q: 'Gödel\'s incompleteness theorem states that any consistent, sufficiently expressive formal system...',
    a: 'Contains true statements it cannot prove',
    choices: ['Contains true statements it cannot prove', 'Has infinite axioms', 'Is always complete', 'Cannot handle integers'],
  },
};

function getDbDefinitionTranslation(question) {
  if (!question) return null;
  const normalized = String(question).replace(/\s+/g, ' ').trim();
  return DB_DEFINITION_ES[question] || DB_DEFINITION_ES[normalized] || null;
}

function getDbDefinitionEnglishOverride(question) {
  if (!question) return null;
  const normalized = String(question).replace(/\s+/g, ' ').trim();
  return DB_DEFINITION_EN_OVERRIDES[question] || DB_DEFINITION_EN_OVERRIDES[normalized] || null;
}

function localizeDbProblemRow(data, lang) {
  const isDefinition = data?.is_definition_type || data?.problem_type === 'definition';
  if (lang !== 'es') {
    const englishOverride = isDefinition ? getDbDefinitionEnglishOverride(data?.question) : null;
    if (!englishOverride) return data;
    return {
      ...data,
      source_question: data.question,
      source_answer: data.correct_answer,
      source_choices: data.answer_options,
      question: englishOverride.q,
      correct_answer: englishOverride.a,
      answer_options: englishOverride.choices,
      is_definition_type: true,
      problem_type: 'definition',
    };
  }

  const translatedDefinition = getDbDefinitionTranslation(data?.question);
  if (isDefinition && translatedDefinition) {
    return {
      ...data,
      source_question: data.question,
      source_answer: data.correct_answer,
      source_choices: data.answer_options,
      question: translatedDefinition.q,
      correct_answer: translatedDefinition.a,
      answer_options: translatedDefinition.choices,
      is_definition_type: true,
      problem_type: 'definition',
    };
  }

  if (data?.problem_type === 'sequence' && typeof data.question === 'string') {
    return {
      ...data,
      source_question: data.question,
      question: data.question.replace(/^Sequence:/, 'Secuencia:'),
    };
  }

  return data;
}

function localizeActiveProblem(problem, lang) {
  if (!problem) return problem;

  if (problem.type === 'definition' || problem.problem_type === 'definition') {
    if (lang === 'es') {
      const sourceQuestion = problem.sourceQuestion || problem.question;
      const translated = getDbDefinitionTranslation(sourceQuestion)
        || Object.values(DB_DEFINITION_ES).find((entry) => entry.q === problem.question);
      if (!translated) return problem;
      return {
        ...problem,
        type: 'definition',
        problem_type: 'definition',
        sourceQuestion,
        question: translated.q,
        masked: translated.q,
        answer: String(translated.a).toLowerCase(),
        choices: translated.choices,
      };
    }

    const entry = Object.entries(DB_DEFINITION_ES)
      .find(([sourceQuestion, translated]) => problem.sourceQuestion === sourceQuestion || problem.question === translated.q);
    if (!entry) return problem;
    const [sourceQuestion] = entry;
    const englishOverride = getDbDefinitionEnglishOverride(sourceQuestion);
    return {
      ...problem,
      type: 'definition',
      problem_type: 'definition',
      sourceQuestion,
      question: englishOverride?.q || sourceQuestion,
      masked: englishOverride?.q || sourceQuestion,
      answer: String(englishOverride?.a || problem.sourceAnswer || problem.answer).toLowerCase(),
      choices: englishOverride?.choices || (Array.isArray(problem.sourceChoices) ? problem.sourceChoices : problem.choices),
    };
  }

  if (problem.problem_type === 'sequence' && typeof problem.question === 'string') {
    if (lang === 'es' && /^Sequence:/.test(problem.question)) {
      return {
        ...problem,
        sourceQuestion: problem.sourceQuestion || problem.question,
        question: problem.question.replace(/^Sequence:/, 'Secuencia:'),
        masked: problem.masked?.replace?.(/^Sequence:/, 'Secuencia:') || problem.masked,
      };
    }
    if (lang === 'en' && /^Secuencia:/.test(problem.question)) {
      const sourceQuestion = problem.sourceQuestion || problem.question.replace(/^Secuencia:/, 'Sequence:');
      return {
        ...problem,
        sourceQuestion,
        question: sourceQuestion,
        masked: problem.masked?.replace?.(/^Secuencia:/, 'Sequence:') || problem.masked,
      };
    }
  }

  return problem;
}

export default function Board({ account, setGameMessage, setGameCompleted, setGameData }) {
  const { t, language } = useI18n();
  const { currency } = useCurrency();
  const { playSuccess, playFailure, playNftDrop, playTierUp } = useSound();

  const [problem, setProblem] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [preGameCountdown, setPreGameCountdown] = useState(3);
  const [isDisabled, setIsDisabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gameCompletedLocal, setGameCompletedLocal] = useState(false);
  const [totalMined, setTotalMined] = useState(0);
  const [level, setLevel] = useState(0);
  const [levelFlash, setLevelFlash] = useState(null);
  const [wrongFeedbackActive, setWrongFeedbackActive] = useState(false);
  const [correctFeedbackActive, setCorrectFeedbackActive] = useState(false);
  const [preGameLine, setPreGameLine] = useState(PRE_GAME_LINES[0]);
  const [walletMeta, setWalletMeta] = useState({
    eur: 0,
    usd: 0,
    cny: 0,
    lifeUsed: false,
    lucky50Claimed: false,
    lucky100Claimed: false,
    lucky500Claimed: false,
    lucky1000Claimed: false,
    walletEmojis: [],
    nftjis: [],
  });
  const [postFailOffer, setPostFailOffer] = useState(null);
  const [postSuccessOffer, setPostSuccessOffer] = useState(null);
  const [isResolvingFail, setIsResolvingFail] = useState(false);
  const [isClaimingSuccess, setIsClaimingSuccess] = useState(false);
  const [isAwaitingStart, setIsAwaitingStart] = useState(false);
  const [isAwaitingContinue, setIsAwaitingContinue] = useState(false);
  const [dailyMineUsed, setDailyMineUsed] = useState(0);
  const [execsCount, setExecsCount] = useState(0);
  const shouldShowProblem = !isAwaitingStart && !isAwaitingContinue;

  const PRICE = Number(process.env.NEXT_PUBLIC_FAKE_MINING_PRICE) || 0.00001;
  const preRef = useRef(null);
  const solveRef = useRef(null);
  const solveStartedAtRef = useRef(null);
  const refreshUiTimeoutRef = useRef(null);
  const levelFlashTimeoutRef = useRef(null);
  const didMountRef = useRef(false);
  const problemStorageKey = `mm3-active-problem:${account?.toLowerCase() || 'guest'}:${language}`;

  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pickOne = (items) => items[randInt(0, items.length - 1)];
  const clearWrongFeedback = () => setWrongFeedbackActive(false);
  const clearCorrectFeedback = () => setCorrectFeedbackActive(false);
  const clearBoardFeedback = () => {
    setWrongFeedbackActive(false);
    setCorrectFeedbackActive(false);
  };

  const clearGameplayTimers = () => {
    clearInterval(preRef.current);
    clearInterval(solveRef.current);
    if (refreshUiTimeoutRef.current) {
      clearTimeout(refreshUiTimeoutRef.current);
      refreshUiTimeoutRef.current = null;
    }
    if (levelFlashTimeoutRef.current) {
      clearTimeout(levelFlashTimeoutRef.current);
      levelFlashTimeoutRef.current = null;
    }
  };

  const readCachedProblem = () => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(problemStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== PROBLEM_CACHE_VERSION) return null;
      if (parsed?.language && parsed.language !== language) return null;
      if (!parsed?.problem?.question || parsed.problem.answer === undefined) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCachedProblem = (nextProblem, lvl) => {
    if (typeof window === 'undefined' || !nextProblem) return;
    try {
      window.sessionStorage.setItem(
        problemStorageKey,
        JSON.stringify({
          version: PROBLEM_CACHE_VERSION,
          language,
          level: clampLevel(lvl),
          problem: nextProblem,
          savedAt: Date.now(),
        })
      );
    } catch {
      // Gameplay should never depend on browser storage being available.
    }
  };

  /* ── Math helpers ── */
  const gcd = (a, b) => b === 0 ? Math.abs(a) : gcd(b, a % b);
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  const reduceFrac = (n, d) => { const g = gcd(Math.abs(n), Math.abs(d)); return [n / g, d / g]; };
  const fracStr = (n, d) => d === 1 ? String(n) : `${n}/${d}`;

  const PRIMES = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199];
  const isPrime = (n) => PRIMES.includes(n);
  const primeFactors = (n) => {
    const factors = [];
    let value = Math.abs(n);
    for (const p of PRIMES) {
      if (p * p > value) break;
      while (value % p === 0) {
        factors.push(p);
        value /= p;
      }
    }
    if (value > 1) factors.push(value);
    return factors;
  };

  const shuffle = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const buildNumericChoices = (answer, spreadBase = 3) => {
    const correct = String(answer);
    const n = Number(answer);
    if (!Number.isFinite(n)) return [];
    const near = new Set();
    const spread = Math.max(spreadBase, Math.ceil(Math.abs(n) * 0.08));
    while (near.size < 3) {
      const delta = randInt(1, spread) * (Math.random() < 0.5 ? -1 : 1);
      const candidate = String(n + delta);
      if (candidate !== correct) near.add(candidate);
    }
    return shuffle([correct, ...near]);
  };

  const getReviveCostOption = (meta) => {
    if ((Number(meta?.eur) || 0) >= REVIVE_COST_EUR) {
      return { currency: 'EUR', amount: REVIVE_COST_EUR, field: 'eur_earned' };
    }
    if ((Number(meta?.usd) || 0) >= REVIVE_COST_USD) {
      return { currency: 'USD', amount: REVIVE_COST_USD, field: 'usd_earned' };
    }
    if ((Number(meta?.cny) || 0) >= REVIVE_COST_CNY) {
      return { currency: 'CNY', amount: REVIVE_COST_CNY, field: 'cny_earned' };
    }
    return null;
  };

  const refreshWalletMeta = async (wallet) => {
    if (!wallet) {
      setWalletMeta({
        eur: 0,
        usd: 0,
        cny: 0,
        lifeUsed: false,
        lucky50Claimed: false,
        lucky100Claimed: false,
        lucky500Claimed: false,
        lucky1000Claimed: false,
        walletEmojis: [],
        nftjis: [],
      });
      return;
    }

    try {
      const [{ data: progress }, { data: squeezeNftji }] = await Promise.all([
        supabase
          .from('player_progress')
          .select('eur_earned, usd_earned, cny_earned, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level, wallet_emojis, mining_nftji_key, mining_nftji_levels, relay_exec_count')
          .eq('wallet', wallet)
          .maybeSingle(),
        supabase
          .from('mm3_squeezing_nftji')
          .select('equipped, attack_level, defense_level')
          .eq('wallet', wallet)
          .maybeSingle(),
      ]);

      const miningNftjiKey = progress?.mining_nftji_key || null;
      const miningNftjiEmoji = await getMiningNftjiEmoji(miningNftjiKey);

      setWalletMeta({
        eur: Number(progress?.eur_earned) || 0,
        usd: Number(progress?.usd_earned) || 0,
        cny: Number(progress?.cny_earned) || 0,
        lifeUsed: Boolean(progress?.life_used),
        lucky50Claimed: Boolean(progress?.lucky_50_claimed),
        lucky100Claimed: Boolean(progress?.lucky_100_claimed),
        lucky500Claimed: Boolean(progress?.lucky_500_claimed),
        lucky1000Claimed: Boolean(progress?.lucky_1000_claimed),
        lucky50Level: Number(progress?.lucky_50_level ?? -1),
        lucky100Level: Number(progress?.lucky_100_level ?? -1),
        lucky500Level: Number(progress?.lucky_500_level ?? -1),
        lucky1000Level: Number(progress?.lucky_1000_level ?? -1),
        walletEmojis: Array.isArray(progress?.wallet_emojis) ? progress.wallet_emojis : [],
        nftjis: buildTrainingNftjis(progress, squeezeNftji, miningNftjiEmoji),
      });
    } catch (error) {
      console.error('wallet meta load:', error);
    }
  };

  const loadMiningAttempts = async (wallet) => {
    if (!wallet) { setDailyMineUsed(0); setExecsCount(0); return { mineUsed: 0, execs: 0 }; }
    try {
      const { start, end } = getUtcDayBounds();
      const [{ count: gamesCount }, { count: txCount }] = await Promise.all([
        supabase.from('games').select('id', { count: 'exact', head: true }).eq('wallet', wallet).gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('mm3_sell_transactions').select('id', { count: 'exact', head: true }).eq('wallet', wallet),
      ]);
      const mineUsed = Number(gamesCount) || 0;
      const execs = Number(txCount) || 0;
      setDailyMineUsed(mineUsed);
      setExecsCount(execs);
      return { mineUsed, execs };
    } catch { return { mineUsed: 0, execs: 0 }; }
  };

  useEffect(() => {
    let cancelled = false;
    clearGameplayTimers();

    if (account && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-toast-clear'));
    }

    const load = async () => {
      let loadedLevel = 0;
      let loadedAttempts = null;
      try {
        if (!account) {
          setLevel(0);
          setTotalMined(0);
          refreshWalletMeta(null);
          setDailyMineUsed(0);
          setExecsCount(0);
        } else {
          const wallet = account.toLowerCase();
          const [{ data: progress }, { data: stats }] = await Promise.all([
            supabase.from('player_progress').select('level').eq('wallet', wallet).maybeSingle(),
            supabase.from('leaderboard_data').select('total_eth').eq('wallet', wallet).maybeSingle(),
          ]);
          if (!progress) {
            // No DB row yet — create it via server-side route (bypasses INSERT RLS restriction)
            await fetch('/api/create-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'wallet', wallet }),
            }).catch(() => {});
          }
          loadedLevel = clampLevel(progress?.level ?? 0);
          setLevel(loadedLevel);
          setTotalMined(parseFloat(stats?.total_eth) || 0);
          await refreshWalletMeta(wallet);
          loadedAttempts = await loadMiningAttempts(wallet);
        }
      } catch (e) {
        console.error('level load:', e);
      }
      if (cancelled) return;
      didMountRef.current = true;
      const mineTotal = DAILY_MINE_BASE + (loadedAttempts?.execs || 0);
      const mineLeft = Math.max(0, mineTotal - (loadedAttempts?.mineUsed || 0));
      const cachedProblem = readCachedProblem();
      if (cachedProblem?.problem && mineLeft > 0) {
        if (cancelled) return;
        setProblem(cachedProblem.problem);
        setElapsedTime(0);
        setPreGameCountdown(999);
        setIsDisabled(true);
        setGameCompletedLocal(false);
        setGameCompleted(false);
        setPostFailOffer(null);
        setPostSuccessOffer(null);
        setIsResolvingFail(false);
        setIsClaimingSuccess(false);
        setIsAwaitingStart(loadedLevel === 0);
        setIsAwaitingContinue(loadedLevel > 0);
        setIsRefreshing(false);
        if (!account) notifyGuestMining();
        return;
      }
      await fetchPhrase(loadedLevel);
      if (cancelled) return;
      if (!account) notifyGuestMining();
    };

    load();
    return () => {
      cancelled = true;
      clearGameplayTimers();
    };
  }, [account]);

  useEffect(() => {
    if (!wrongFeedbackActive || typeof document === 'undefined') return undefined;

    document.body.classList.add('mm3-play-fail-alert');

    const clearOnAction = (event) => {
      if (event.target?.closest?.('button,a,[role="button"],input,select')) {
        clearBoardFeedback();
      }
    };

    document.addEventListener('click', clearOnAction, true);
    return () => {
      document.body.classList.remove('mm3-play-fail-alert');
      document.removeEventListener('click', clearOnAction, true);
    };
  }, [wrongFeedbackActive]);

  useEffect(() => {
    if (!correctFeedbackActive || typeof document === 'undefined') return undefined;

    document.body.classList.add('mm3-play-success-alert');

    const clearOnAction = (event) => {
      if (event.target?.closest?.('button,a,[role="button"],input,select')) {
        clearBoardFeedback();
      }
    };

    document.addEventListener('click', clearOnAction, true);
    return () => {
      document.body.classList.remove('mm3-play-success-alert');
      document.removeEventListener('click', clearOnAction, true);
    };
  }, [correctFeedbackActive]);

  useEffect(() => {
    const onDbUpdated = (event) => {
      if (!account) return;
      const detail = event?.detail || {};
      const detailWallet = String(detail.wallet || '').toLowerCase();
      const matchesWallet = !detailWallet || detailWallet === account.toLowerCase();
      if (!matchesWallet) return;
      if (detail.reward) {
        setWalletMeta((current) => ({
          ...current,
          eur: Number(current.eur) + (Number(detail.reward.EUR) || 0),
          usd: Number(current.usd) + (Number(detail.reward.USD) || 0),
          cny: Number(current.cny) + (Number(detail.reward.CNY) || 0),
        }));
      }
      if (detail.special || detail.trade || detail.dailyTask || detail.reward) refreshWalletMeta(account.toLowerCase());
      loadMiningAttempts(account.toLowerCase());
    };
    window.addEventListener('mm3-db-updated', onDbUpdated);
    return () => window.removeEventListener('mm3-db-updated', onDbUpdated);
  }, [account]);

  useEffect(() => () => clearGameplayTimers(), []);

  useEffect(() => {
    setProblem((current) => {
      const localized = localizeActiveProblem(current, language);
      if (localized === current) return current;
      writeCachedProblem(localized, level);
      return localized;
    });
  }, [language]);

  const genArith = (diff, lvl, lang = 'en') => {
    const g = GT[lang] || GT.en;
    const range = 20 + diff * 35 + lvl * 2;

    if (diff >= 4 || lvl >= 45) {
      const a = randInt(12, range);
      const b = randInt(3, Math.max(15, Math.floor(range / 2)));
      const c = randInt(2, Math.max(12, Math.floor(range / 3)));
      const forms = [
        { question: `(${a} + ${b}) × ${c} =`, answer: (a + b) * c },
        { question: `${a} × ${c} - ${b} =`, answer: a * c - b },
        { question: `${a} + ${b} × ${c} =`, answer: a + b * c },
        { question: `(${a} - ${b}) × ${c} =`, answer: (a - b) * c },
        { question: `${a} × (${c} + 1) - ${b} =`, answer: a * (c + 1) - b },
        { question: `${a} + ${b} + ${c} =`, answer: a + b + c },
      ];

      if (lvl >= 70) {
        const divisor = randInt(2, 12);
        const quotient = randInt(6, 18);
        const dividend = divisor * quotient;
        forms.push({
          question: `(${dividend} ÷ ${divisor}) + ${b} =`,
          answer: quotient + b,
        });
        const avgA = randInt(7, 26) * 3;
        const avgB = randInt(7, 26) * 3;
        forms.push({
          question: g.averageOf(avgA, avgB, avgA + avgB),
          answer: (avgA + avgB + (avgA + avgB)) / 3,
        });
        const d = randInt(2, 15);
        forms.push({
          question: `(${a} + ${b}) - (${c} + ${d}) =`,
          answer: (a + b) - (c + d),
        });
      }

      const picked = pickOne(forms);
      return {
        type: 'arith2',
        problem_type: 'arithmetic',
        question: picked.question,
        answer: String(picked.answer),
        masked: `${picked.question.replace(/=\s*$/, '')} [MASK]`,
        placeholder: '?',
        choices: buildNumericChoices(picked.answer, 10 + diff * 3),
        difficulty: diff,
      };
    }

    const ops = diff >= 3 ? ['+', '-', '*'] : ['+', '-', '*', '/'];
    const op = pickOne(ops);
    let a = randInt(8, Math.min(999, range));
    let b = randInt(2, Math.min(99, range));

    if (op === '/') {
      b = randInt(2, 12);
      a = b * randInt(3, Math.min(20, 6 + diff * 2));
    }

    if (lvl >= 18 && diff >= 2 && Math.random() < 0.45) {
      const c = randInt(2, 16 + diff * 3);
      const tailOp = pickOne(['+', '-']);
      const middleOp = pickOne(['+', '-']);
      const forms = [
        {
          question: `${a} ${op} ${b} ${tailOp} ${c} =`,
          answer: (op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b) + (tailOp === '+' ? c : -c),
        },
        {
          question: `${a} ${middleOp} ${b} ${op} ${c} =`,
          answer: middleOp === '+'
            ? a + (op === '+' ? b + c : op === '-' ? b - c : op === '*' ? b * c : b / c)
            : a - (op === '+' ? b + c : op === '-' ? b - c : op === '*' ? b * c : b / c),
        },
      ];
      const picked = pickOne(forms);
      return {
        type: 'arith2',
        problem_type: 'arithmetic',
        question: picked.question,
        answer: String(picked.answer),
        masked: `${picked.question.replace(/=\s*$/, '')} [MASK]`,
        placeholder: '?',
        choices: buildNumericChoices(picked.answer, 8 + diff * 2),
        difficulty: diff,
      };
    }

    const answer = ({ '+': a + b, '-': a - b, '*': a * b, '/': a / b })[op];
    return {
      type: 'arith2',
      problem_type: 'arithmetic',
      question: `${a} ${op} ${b} =`,
      answer: String(answer),
      masked: `${a} ${op} ${b} = [MASK]`,
      placeholder: '?',
      choices: buildNumericChoices(answer, 8 + diff * 2),
      difficulty: diff,
    };
  };

  const genOpFix = (diff, lvl) => {
    const ops = ['+','-','*','/'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = randInt(6, 45 + diff * 12 + lvl);
    let b = randInt(2, 18 + diff * 4);
    if (op === '/') {
      b = randInt(2, 12);
      a = b * randInt(3, 14 + diff);
    }
    const answer = ({ '+': a + b, '-': a - b, '*': a * b, '/': a / b })[op];
    const valid = ops.filter((candidate) => ({ '+': a + b, '-': a - b, '*': a * b, '/': a / b })[candidate] === answer);
    if (valid.length !== 1) return genOpFix(diff, lvl);
    return {
      type: 'opfix',
      problem_type: 'operator_fix',
      question: `${a} ? ${b} = ${answer}`,
      answer: op,
      masked: `${a} [MASK] ${b} = ${answer}`,
      placeholder: 'op',
      choices: shuffle([op, ...shuffle(ops.filter((candidate) => candidate !== op)).slice(0, 3)]),
      difficulty: diff,
    };
  };

  const genDigitFix = (diff, lvl) => {
    const opPool = diff >= 3 ? ['+', '-', '*'] : ['+', '-'];
    const op = pickOne(opPool);
    let x = randInt(15, 120 + diff * 25 + lvl);
    let y = randInt(5, 70 + diff * 8);
    if (op === '*') {
      x = randInt(4, 25);
      y = randInt(3, 12);
    }
    const z = op === '+' ? x + y : op === '-' ? x - y : x * y;
    if (z < 0) return genDigitFix(diff, lvl);

    const targetKey = pickOne(['x', 'y', 'z']);
    const targetValue = targetKey === 'x' ? x : targetKey === 'y' ? y : z;
    const digits = String(targetValue).padStart(targetValue < 100 ? 2 : 3, '0').split('');
    const validIndexes = digits
      .map((digit, index) => ({ digit, index }))
      .filter(({ digit }, index) => !(digits.length > 1 && index === 0 && digit === '0'));
    const hideIndex = validIndexes[randInt(0, validIndexes.length - 1)].index;
    const answerDigit = digits[hideIndex];
    digits[hideIndex] = '?';
    const maskedValue = digits.join('').replace(/^0+/, '') || '0';

    const candidates = [];
    for (let d = 0; d <= 9; d++) {
      const testDigits = [...digits];
      testDigits[hideIndex] = String(d);
      const candidateValue = Number(testDigits.join(''));
      if (String(candidateValue).length !== digits.length && digits[0] === '?') continue;
      const testX = targetKey === 'x' ? candidateValue : x;
      const testY = targetKey === 'y' ? candidateValue : y;
      const testZ = targetKey === 'z' ? candidateValue : z;
      const works = op === '+' ? testX + testY === testZ : op === '-' ? testX - testY === testZ : testX * testY === testZ;
      if (works) candidates.push(d);
    }
    if (candidates.length !== 1) return genDigitFix(diff, lvl);

    const leftValue = targetKey === 'x' ? maskedValue : x;
    const rightValue = targetKey === 'y' ? maskedValue : y;
    const resultValue = targetKey === 'z' ? maskedValue : z;
    const correct = String(answerDigit);
    const pool = new Set();
    while (pool.size < 3) {
      const candidate = String(randInt(0, 9));
      if (candidate !== correct) pool.add(candidate);
    }

    return {
      type: 'digitfix',
      problem_type: 'digit_fix',
      question: `${leftValue} ${op} ${rightValue} = ${resultValue}`,
      answer: correct,
      masked: `${leftValue} ${op} ${rightValue} = ${resultValue}`,
      placeholder: 'digit',
      choices: shuffle([correct, ...pool]),
      difficulty: diff,
    };
  };

  const genPowers = (diff, lvl) => {
    const base = randInt(2, Math.min(14, 8 + diff + Math.floor(lvl / 20)));
    const exp = randInt(2 + Math.floor(diff / 2), Math.min(6, 3 + diff));
    const forms = [
      { question: `${base}^${exp} =`, answer: Math.pow(base, exp) },
      { question: `${base}^${exp - 1} × ${base} =`, answer: Math.pow(base, exp) },
    ];
    if (diff >= 3) {
      const value = Math.pow(base, Math.max(2, exp - 1));
      forms.push({ question: `?^${Math.max(2, exp - 1)} = ${value}`, answer: base });
    }
    if (diff >= 4) {
      forms.push({ question: `(${base}^2)^${Math.max(1, exp - 2)} =`, answer: Math.pow(base, 2 * Math.max(1, exp - 2)) });
    }
    const picked = pickOne(forms);
    return {
      type: 'powers',
      problem_type: 'powers',
      question: picked.question,
      answer: String(picked.answer),
      masked: `${picked.question.replace(/=\s*$/, '')} [MASK]`,
      placeholder: '?',
      choices: buildNumericChoices(picked.answer, 12 + diff * 4),
      difficulty: diff,
    };
  };

  const genSequence = (diff, lvl, lang = 'en') => {
    const g = GT[lang];
    const modePool = ['arithmetic', 'geometric', 'fibonacci'];
    if (diff >= 3) modePool.push('quadratic');
    if (lvl >= 60) modePool.push('alternating');
    if (lvl >= 25) modePool.push('triangular');
    if (lvl >= 35) modePool.push('squares');
    const type = pickOne(modePool);

    let seq = [];
    let nextVal = 0;
    let label = g.seq;

    if (type === 'arithmetic') {
      const a = randInt(2, 25);
      const d = randInt(2, 12 + diff);
      seq = [a, a + d, a + 2 * d, a + 3 * d, a + 4 * d];
      nextVal = a + 5 * d;
    } else if (type === 'geometric') {
      const a = randInt(2, 6);
      const r = randInt(2, 3 + Math.floor(diff / 2));
      seq = [a, a * r, a * r * r, a * r * r * r];
      nextVal = a * r * r * r * r;
    } else if (type === 'quadratic') {
      const start = randInt(1, 8);
      seq = [start, start + 3, start + 8, start + 15, start + 24];
      nextVal = start + 35;
    } else if (type === 'triangular') {
      const start = randInt(0, 4);
      seq = [start + 1, start + 3, start + 6, start + 10, start + 15];
      nextVal = start + 21;
    } else if (type === 'squares') {
      const start = randInt(2, 5);
      seq = [start * start, (start + 1) ** 2, (start + 2) ** 2, (start + 3) ** 2];
      nextVal = (start + 4) ** 2;
    } else if (type === 'alternating') {
      const a = randInt(2, 8);
      seq = [a, a * 2, a + 3, (a + 3) * 2, a + 6];
      nextVal = (a + 6) * 2;
    } else {
      label = g.fib;
      seq = [1, 1, 2, 3, 5, 8, 13];
      nextVal = 21;
    }

    const question = `${label}: ${seq.join(', ')}, ?`;
    return {
      type: 'sequence',
      problem_type: 'sequence',
      question,
      answer: String(nextVal),
      masked: question,
      placeholder: '?',
      choices: buildNumericChoices(nextVal, 6 + diff * 3),
      difficulty: diff,
    };
  };

  const genModulo = (diff, _lvl) => {
    if (diff <= 2) {
      const b = randInt(2, 9 + diff);
      const a = randInt(b + 1, 40 + diff * 15 + _lvl);
      if (Math.random() < 0.5) {
        const ans = a % b;
        return { type: 'modulo', problem_type: 'modulo', question: `${a} mod ${b} =`, answer: String(ans), masked: `${a} mod ${b} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 3), difficulty: diff };
      }
      const c = randInt(b + 1, 40 + diff * 12 + _lvl);
      const ans = (a + c) % b;
      return { type: 'modulo', problem_type: 'modulo', question: `(${a} + ${c}) mod ${b} =`, answer: String(ans), masked: `(${a} + ${c}) mod ${b} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 3), difficulty: diff };
    }
    if (diff === 3) {
      const b = randInt(5, 13); const a = randInt(4, 20);
      if (Math.random() < 0.5) {
        const ans = (a * a) % b;
        return { type: 'modulo', problem_type: 'modulo', question: `${a}² mod ${b} =`, answer: String(ans), masked: `${a}² mod ${b} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 4), difficulty: diff };
      }
      const c = randInt(3, 12);
      const ans = (a - c) % b >= 0 ? (a - c) % b : ((a - c) % b) + b;
      return { type: 'modulo', problem_type: 'modulo', question: `(${a} - ${c}) mod ${b} =`, answer: String(ans), masked: `(${a} - ${c}) mod ${b} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 4), difficulty: diff };
    }
    if (diff === 4) {
      const c = randInt(7, 17); const a = randInt(3, 15); const b2 = randInt(3, 15);
      if (Math.random() < 0.5) {
        const ans = (a * b2) % c;
        return { type: 'modulo', problem_type: 'modulo', question: `${a} × ${b2} mod ${c} =`, answer: String(ans), masked: `${a} × ${b2} mod ${c} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 5), difficulty: diff };
      }
      const ans = (a * a + b2) % c;
      return { type: 'modulo', problem_type: 'modulo', question: `(${a}² + ${b2}) mod ${c} =`, answer: String(ans), masked: `(${a}² + ${b2}) mod ${c} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 5), difficulty: diff };
    }
    const m = randInt(5, 13); const n = randInt(4, 10);
    if (Math.random() < 0.5) {
      const ans = Math.pow(2, n) % m;
      return { type: 'modulo', problem_type: 'modulo', question: `2^${n} mod ${m} =`, answer: String(ans), masked: `2^${n} mod ${m} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 4), difficulty: diff };
    }
    const a = randInt(2, 8);
    const b = randInt(2, 6);
    const ans = Math.pow(a, b) % m;
    return { type: 'modulo', problem_type: 'modulo', question: `${a}^${b} mod ${m} =`, answer: String(ans), masked: `${a}^${b} mod ${m} = [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 4), difficulty: diff };
  };

  const genLogic = (diff, _lvl, lang = 'en') => {
    const g = GT[lang] || GT.en;
    const T = g.truth, F = g.falsehood;
    const bools = [T, F];

    if (diff <= 2) {
      const op = Math.random() < 0.5 ? g.and : g.or;
      const a = bools[randInt(0, 1)]; const b = bools[randInt(0, 1)];
      const result = op === g.and ? (a === T && b === T ? T : F) : (a === T || b === T ? T : F);
      return { type: 'logic', problem_type: 'logic', question: `${a} ${op} ${b} =`, answer: result, masked: `${a} ${op} ${b} = [MASK]`, placeholder: '?', choices: shuffle([T, F, g.maybe, g.both]), difficulty: diff };
    }

    if (diff === 3) {
      if (Math.random() < 0.5) {
        const a = bools[randInt(0, 1)]; const result = a === T ? F : T;
        return { type: 'logic', problem_type: 'logic', question: `${g.not} ${a} =`, answer: result, masked: `${g.not} ${a} = [MASK]`, placeholder: '?', choices: shuffle([T, F, g.nil, '?']), difficulty: diff };
      }
      const a = bools[randInt(0, 1)]; const b = bools[randInt(0, 1)];
      const result = a !== b ? T : F;
      return { type: 'logic', problem_type: 'logic', question: `${a} XOR ${b} =`, answer: result, masked: `${a} XOR ${b} = [MASK]`, placeholder: '?', choices: shuffle([T, F, g.nil, g.both]), difficulty: diff };
    }

    if (diff === 4) {
      const labels = shuffle(['A', 'B', 'C', 'D']).slice(0, 4);
      const [x, y, z, w] = labels;
      const qs = [
        { q: `${x} > ${y}, ${y} > ${z}. ${g.greatest}`, a: x, others: [y, z, g.equal] },
        { q: `${x} > ${y}, ${y} > ${z}. ${g.least}`,    a: z, others: [x, y, g.equal] },
        { q: `${x} > ${y}, ${y} > ${z}. ${g.middle}`,   a: y, others: [x, z, g.none] },
        { q: `${x} > ${y}, ${z} > ${w}, ${x} > ${z}. ${g.smallest}`, a: w, others: [x, y, z] },
      ];
      const picked = pickOne(qs);
      return { type: 'logic', problem_type: 'logic', question: picked.q, answer: picked.a, masked: picked.q, placeholder: '?', choices: shuffle([picked.a, ...picked.others]), difficulty: diff };
    }

    const scenarios = [
      { q: `P→Q, Q→R, P=${T}. R=?`, a: T, others: [F, g.unknown, g.nil] },
      { q: `P→Q, Q→R, R=${F}. P=?`, a: F, others: [T, g.unknown, g.maybe] },
      { q: `${g.not} P→Q, P=${F}. Q=?`, a: T, others: [F, g.unknown, g.nil] },
      { q: `P→Q, P=${F}. Q=?`, a: g.unknown, others: [T, F, g.nil] },
      { q: `P=${T}, Q=${F}. P ${g.and} ${g.not} Q = ?`, a: T, others: [F, g.unknown, g.nil] },
      { q: `P=${T}, Q=${F}. P ↔ Q = ?`, a: F, others: [T, g.unknown, g.nil] },
    ];
    const s = scenarios[randInt(0, scenarios.length - 1)];
    return { type: 'logic', problem_type: 'logic', question: s.q, answer: s.a, masked: s.q, placeholder: '?', choices: shuffle([s.a, ...s.others]), difficulty: diff };
  };

  const genFractions = (diff, lvl) => {
    const denoms = [2, 3, 4, 5, 6, 8, 10, 12];
    const makeFracWrongs = (rn, rd, count = 3) => {
      const ans = fracStr(rn, rd);
      const wrong = new Set();
      let tries = 0;
      while (wrong.size < count && tries < 60) {
        tries++;
        const delta = randInt(1, 4) * (Math.random() < 0.5 ? 1 : -1);
        const wn = rn + delta;
        if (wn > 0) { const [wn2, wd2] = reduceFrac(wn, rd); const w = fracStr(wn2, wd2); if (w !== ans) wrong.add(w); }
      }
      const fallbacks = ['1/2', '3/4', '2/3', '1/3', '5/6', '3/8'].filter(f => f !== ans);
      for (const f of fallbacks) { if (wrong.size >= count) break; wrong.add(f); }
      return [...wrong].slice(0, count);
    };

    if (diff <= 2) {
      const d1 = denoms[randInt(0, 3)]; const d2 = denoms[randInt(0, 3)];
      const a = randInt(1, d1 - 1); const b = randInt(1, d2 - 1);
      if (Math.random() < 0.5) {
        const lcd = lcm(d1, d2);
        const num = a * (lcd / d1) + b * (lcd / d2);
        const [rn, rd] = reduceFrac(num, lcd);
        const ans = fracStr(rn, rd);
        return { type: 'fractions', problem_type: 'fractions', question: `${a}/${d1} + ${b}/${d2} =`, answer: ans, masked: `${a}/${d1} + ${b}/${d2} = [MASK]`, placeholder: '?', choices: shuffle([ans, ...makeFracWrongs(rn, rd)]), difficulty: diff };
      }
      const eqMul = randInt(2, 5);
      const ans = String(a * eqMul);
      return { type: 'fractions', problem_type: 'fractions', question: `${a}/${d1} = ?/${d1 * eqMul}`, answer: ans, masked: `${a}/${d1} = ?/${d1 * eqMul}`, placeholder: '?', choices: buildNumericChoices(Number(ans), 3), difficulty: diff };
    }

    if (diff === 3) {
      const d1 = denoms[randInt(1, 5)]; const d2 = denoms[randInt(1, 5)];
      const a = randInt(1, d1); const b = randInt(1, d2);
      const lcd = (d1 * d2) / gcd(d1, d2);
      const num = a * (lcd / d1) - b * (lcd / d2);
      if (num <= 0) return genFractions(diff, lvl);
      const [rn, rd] = reduceFrac(num, lcd);
      const ans = fracStr(rn, rd);
      return { type: 'fractions', problem_type: 'fractions', question: `${a}/${d1} - ${b}/${d2} =`, answer: ans, masked: `${a}/${d1} - ${b}/${d2} = [MASK]`, placeholder: '?', choices: shuffle([ans, ...makeFracWrongs(rn, rd)]), difficulty: diff };
    }

    if (diff === 4) {
      const d1 = denoms[randInt(0, 4)]; const d2 = denoms[randInt(0, 4)];
      const a = randInt(1, d1); const b = randInt(1, d2);
      if (Math.random() < 0.5) {
        const [rn, rd] = reduceFrac(a * b, d1 * d2);
        const ans = fracStr(rn, rd);
        return { type: 'fractions', problem_type: 'fractions', question: `${a}/${d1} × ${b}/${d2} =`, answer: ans, masked: `${a}/${d1} × ${b}/${d2} = [MASK]`, placeholder: '?', choices: shuffle([ans, ...makeFracWrongs(rn, rd)]), difficulty: diff };
      }
      const left = a * d2;
      const right = b * d1;
      const ans = left > right ? '>' : left < right ? '<' : '=';
      return { type: 'fractions', problem_type: 'fractions', question: `${a}/${d1} ? ${b}/${d2}`, answer: ans, masked: `${a}/${d1} [MASK] ${b}/${d2}`, placeholder: '?', choices: shuffle(['>', '<', '=']), difficulty: diff };
    }

    const d1 = denoms[randInt(0, 4)]; const d2 = denoms[randInt(0, 4)];
    const a = randInt(1, d1); const b = randInt(1, d2);
    const [rn, rd] = reduceFrac(a * d2, d1 * b);
    const ans = fracStr(rn, rd);
    return { type: 'fractions', problem_type: 'fractions', question: `${a}/${d1} ÷ ${b}/${d2} =`, answer: ans, masked: `${a}/${d1} ÷ ${b}/${d2} = [MASK]`, placeholder: '?', choices: shuffle([ans, ...makeFracWrongs(rn, rd)]), difficulty: diff };
  };

  const genPrimes = (diff, _lvl, lang = 'en') => {
    const g = GT[lang];
    if (diff <= 2) {
      const pool = [...PRIMES.filter(p => p < (diff === 1 ? 30 : 70)), 4, 6, 8, 9, 10, 12, 14, 15, 18, 20, 21, 22, 25, 27, 35, 49, 51];
      const n = pool[randInt(0, Math.min(pool.length - 1, diff === 1 ? 18 : pool.length - 1))];
      const ans = isPrime(n) ? g.prime : g.notPrime;
      return { type: 'primes', problem_type: 'primes', question: g.isNPrime(n), answer: ans, masked: g.isNPrime(n), placeholder: '?', choices: [g.prime, g.notPrime], difficulty: diff };
    }

    if (diff === 3) {
      if (Math.random() < 0.5) {
        const idx = randInt(0, 24);
        const n = PRIMES[idx]; const next = PRIMES[idx + 1];
        return { type: 'primes', problem_type: 'primes', question: g.nextPrime(n), answer: String(next), masked: `${g.nextPrime(n)} [MASK]`, placeholder: '?', choices: buildNumericChoices(next, 5), difficulty: diff };
      }
      const compositePool = [21, 27, 33, 35, 39, 45, 49, 51, 55, 57, 63, 65, 69, 77, 85, 91];
      const n = pickOne(compositePool);
      const ans = String(primeFactors(n)[0]);
      return { type: 'primes', problem_type: 'primes', question: g.smallFactor(n), answer: ans, masked: `${g.smallFactor(n)} [MASK]`, placeholder: '?', choices: buildNumericChoices(Number(ans), 5), difficulty: diff };
    }

    if (diff === 4) {
      if (Math.random() < 0.5) {
        const sets = [[12,2],[15,2],[18,2],[20,2],[30,3],[42,3],[24,2],[36,2],[60,3],[70,3],[100,2],[84,3],[90,3]];
        const [n, ans] = pickOne(sets);
        return { type: 'primes', problem_type: 'primes', question: g.distFactors(n), answer: String(ans), masked: `${g.distFactors(n)} [MASK]`, placeholder: '?', choices: ['1', '2', '3', '4'], difficulty: diff };
      }
      const idx = randInt(0, 20);
      const a = PRIMES[idx];
      const b = PRIMES[idx + 1];
      const ans = b - a === 2 ? g.yes : g.no;
      return { type: 'primes', problem_type: 'primes', question: g.twinPrimes(a, b), answer: ans, masked: g.twinPrimes(a, b), placeholder: '?', choices: shuffle([g.yes, g.no, g.maybe, g.both]), difficulty: diff };
    }

    if (Math.random() < 0.5) {
      const targets = [{ n: 6, ans: 10 }, { n: 10, ans: 17 }, { n: 12, ans: 28 }, { n: 15, ans: 41 }, { n: 20, ans: 77 }];
      const { n, ans } = pickOne(targets);
      return { type: 'primes', problem_type: 'primes', question: g.sumPrimesLt(n), answer: String(ans), masked: `${g.sumPrimesLt(n)} [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 7), difficulty: diff };
    }
    const ordinal = randInt(6, 18);
    const ans = PRIMES[ordinal - 1];
    return { type: 'primes', problem_type: 'primes', question: g.nthPrime(ordinal), answer: String(ans), masked: `${g.nthPrime(ordinal)} [MASK]`, placeholder: '?', choices: buildNumericChoices(ans, 9), difficulty: diff };
  };

  /* ── Geometry ── */
  const genGeometry = (diff, _lvl, lang = 'en') => {
    const g = GT[lang];
    const mk = (question, answer, spread = 8) => ({
      type: 'geometry', problem_type: 'geometry',
      question, answer: String(answer),
      masked: question, placeholder: '?',
      choices: buildNumericChoices(answer, spread), difficulty: diff,
    });

    if (diff <= 2) {
      const forms = [];
      const w = randInt(3, 12 + diff * 5), h = randInt(2, 10 + diff * 3);
      forms.push({ q: g.rectArea(w, h), a: w * h });
      forms.push({ q: g.rectPerim(w, h), a: 2 * (w + h) });
      const s = randInt(2, 10 + diff * 4);
      forms.push({ q: g.sqArea(s), a: s * s });
      forms.push({ q: g.sqPerim(s), a: 4 * s });
      const base = randInt(2, 10) * 2, ht = randInt(3, 12);
      forms.push({ q: g.triArea(base, ht), a: (base * ht) / 2 });
      const p = pickOne(forms);
      return mk(p.q, p.a, 6 + diff * 3);
    }

    if (diff === 3) {
      const triples = [[3,4,5],[5,12,13],[8,15,17],[7,24,25],[6,8,10],[9,12,15]];
      if (Math.random() < 0.5) {
        const [a, b, c] = pickOne(triples);
        const forms = [
          { q: g.hypot(a, b), a: c },
          { q: g.leg(c, a), a: b },
        ];
        const p = pickOne(forms);
        return mk(p.q, p.a, 5);
      }
      const n = randInt(4, 8);
      return mk(g.ngon(n), (n - 2) * 180, 40);
    }

    if (diff === 4) {
      const forms = [];
      const l = randInt(2, 9), w2 = randInt(2, 7), h2 = randInt(2, 7);
      forms.push({ q: g.cuboid(l, w2, h2), a: l * w2 * h2 });
      const r = randInt(2, 7);
      forms.push({ q: g.circArea(r), a: 3 * r * r });
      forms.push({ q: g.circPerim(r), a: 6 * r });
      const sides = pickOne([6, 8, 12]);
      forms.push({ q: g.regAngle(sides), a: ((sides - 2) * 180) / sides });
      const p = pickOne(forms);
      return mk(p.q, p.a, 14);
    }

    const forms = [];
    const a2 = randInt(3, 10), b2 = randInt(a2 + 2, a2 + 12), h3 = randInt(2, 8) * 2;
    forms.push({ q: g.trapArea(a2, b2, h3), a: ((a2 + b2) * h3) / 2 });
    const tpairs = [[3,4,5],[5,12,13],[8,15,17],[6,8,10]];
    const [ta, tb, tc] = pickOne(tpairs);
    forms.push({ q: g.rectDiag(ta, tb), a: tc });
    const sc = randInt(2, 8);
    forms.push({ q: g.cubeSurf(sc), a: 6 * sc * sc });
    const p = pickOne(forms);
    return mk(p.q, p.a, 18);
  };

  /* ── Percentages ── */
  const genPercentage = (diff, _lvl, lang = 'en') => {
    const g = GT[lang];
    const mk = (question, answer, choices) => ({
      type: 'percentage', problem_type: 'percentage',
      question, answer: String(answer),
      masked: question, placeholder: '?',
      choices: choices || buildNumericChoices(answer, 5 + diff * 3), difficulty: diff,
    });

    if (diff <= 2) {
      const pcts = diff === 1 ? [10, 20, 25, 50] : [10, 15, 20, 25, 30, 40, 50, 75];
      const pct = pickOne(pcts);
      const base = randInt(2, 16) * (diff === 1 ? 20 : 10);
      const ans = (pct * base) / 100;
      if (!Number.isInteger(ans)) return genPercentage(diff, _lvl, lang);
      return mk(g.pctOf(pct, base), ans);
    }

    if (diff === 3) {
      const pct = pickOne([10, 20, 25, 40, 50, 60, 75, 80]);
      const y = randInt(4, 20) * 10;
      const x = (pct * y) / 100;
      if (!Number.isInteger(x) || x === 0) return genPercentage(diff, _lvl, lang);
      const wrongs = shuffle([5,15,30,45,55,70,90].filter(p => p !== pct)).slice(0, 3);
      return mk(g.whatPct(x, y), pct, shuffle([String(pct), ...wrongs.map(String)]));
    }

    if (diff === 4) {
      const orig = randInt(4, 20) * 10;
      const pct = pickOne([10, 20, 25, 50]);
      const change = (pct * orig) / 100;
      const dir = Math.random() < 0.5 ? g.inc : g.dec;
      const result = dir === g.inc ? orig + change : orig - change;
      return mk(g.pctChange(orig, pct, dir), result);
    }

    const pct = pickOne([10, 20, 25, 50]);
    const origVal = randInt(4, 20) * 10;
    const afterVal = origVal * (1 + pct / 100);
    if (!Number.isInteger(afterVal)) return genPercentage(diff, _lvl, lang);
    return mk(g.pctRise(pct, afterVal), origVal);
  };

  /* ── Algebra ── */
  const genAlgebra = (diff, _lvl) => {
    const mk = (question, answer, spread = 6) => ({
      type: 'algebra', problem_type: 'algebra',
      question, answer: String(answer),
      masked: question, placeholder: '?',
      choices: buildNumericChoices(answer, spread), difficulty: diff,
    });

    if (diff <= 2) {
      const x = randInt(1, 20 + diff * 8), a = randInt(2, 15 + diff * 5);
      const op = Math.random() < 0.5 ? '+' : '-';
      const b = op === '+' ? x + a : x - a;
      return mk(`x ${op} ${a} = ${b}   →   x =`, x, 5 + diff * 2);
    }

    if (diff === 3) {
      const x = randInt(1, 15);
      if (Math.random() < 0.5) {
        const a = randInt(2, 9);
        return mk(`${a}x = ${a * x}   →   x =`, x, 6);
      }
      const a = randInt(2, 8);
      return mk(`x ÷ ${a} = ${x}   →   x =`, x * a, 8);
    }

    if (diff === 4) {
      const a = randInt(2, 7), x = randInt(1, 12), b = randInt(1, 15);
      return mk(`${a}x + ${b} = ${a * x + b}   →   x =`, x, 5);
    }

    if (Math.random() < 0.5) {
      const a = randInt(3, 8), c = randInt(1, 2), x = randInt(1, 10), b = randInt(1, 15);
      const d = (a - c) * x + b;
      return mk(`${a}x + ${b} = ${c}x + ${d}   →   x =`, x, 5);
    }
    const x = randInt(3, 12), y = randInt(1, x - 1);
    return {
      type: 'algebra', problem_type: 'algebra',
      question: `x + y = ${x + y},  x − y = ${x - y}   →   x =`,
      answer: String(x),
      masked: `x + y = ${x + y},  x − y = ${x - y}   →   x = [MASK]`,
      placeholder: '?',
      choices: buildNumericChoices(x, 6),
      difficulty: diff,
    };
  };

  const genNumberRiddle = (diff, _lvl, lang = 'en') => {
    const g = GT[lang] || GT.en;
    const mk = (question, answer, spread = 6) => ({
      type: 'number_riddle',
      problem_type: 'algebra',
      question,
      answer: String(answer),
      masked: question,
      placeholder: '?',
      choices: buildNumericChoices(answer, spread),
      difficulty: diff,
    });

    const variants = [];
    const ones = randInt(1, 8);
    const delta = randInt(1, 4);
    const tens = ones + delta;
    variants.push({ q: g.clueDigitSum(tens + ones, delta), a: tens * 10 + ones, spread: 10 });

    const a = pickOne([2, 3, 4, 5, 6]);
    const b = pickOne([3, 4, 5, 7, 8]);
    const extra = randInt(1, 9);
    variants.push({ q: g.clueLcm(a, b, extra), a: lcm(a, b) + extra, spread: 12 });

    const small = randInt(4, 20);
    variants.push({ q: g.clueConsecutive(2 * small + 1, 1), a: small + 1, spread: 7 });

    const addMe = randInt(3, 18);
    variants.push({ q: g.clueTriple(addMe), a: addMe / 2, spread: 5 });

    if (!Number.isInteger(addMe / 2)) variants.pop();

    const remBase = pickOne([4, 5, 6]);
    const remOther = pickOne([3, 5, 7]);
    const r1 = randInt(1, remBase - 1);
    const r2 = randInt(1, remOther - 1);
    let candidate = 1;
    while (!(candidate % remBase === r1 && candidate % remOther === r2)) candidate++;
    variants.push({ q: g.clueRemainder(remBase, r1, remOther, r2), a: candidate, spread: 9 });

    const picked = pickOne(variants);
    return mk(picked.q, picked.a, picked.spread);
  };

  const genWordProblem = (diff, _lvl, lang = 'en') => {
    const g = GT[lang] || GT.en;
    const mk = (question, answer, spread = 8) => ({
      type: 'word_problem',
      problem_type: 'arithmetic',
      question,
      answer: String(answer),
      masked: question,
      placeholder: '?',
      choices: buildNumericChoices(answer, spread),
      difficulty: diff,
    });

    const variants = [];
    const crates = randInt(2, 8);
    const chips = randInt(3, 14);
    const extra = randInt(2, 30);
    variants.push({ q: g.storyCrates(crates, chips, extra), a: crates * chips + extra, spread: 12 });

    const rows = randInt(3, 12);
    const cols = randInt(5, 18);
    const off = randInt(1, Math.min(12, rows * cols - 1));
    variants.push({ q: g.storyRows(rows, cols, off), a: rows * cols - off, spread: 12 });

    const up = randInt(8, 30);
    const slip = randInt(1, 7);
    const up2 = randInt(3, 20);
    variants.push({ q: g.storySteps(up, slip, up2), a: up - slip + up2, spread: 10 });

    const side = randInt(3, 10);
    const width = side + randInt(2, 8);
    variants.push({ q: g.storyGarden(side, width), a: side * width - side * side, spread: 10 });

    const tickets = randInt(3, 12);
    const each = randInt(2, 15);
    const fee = randInt(1, 12);
    variants.push({ q: g.storyTickets(tickets, each, fee), a: tickets * each + fee, spread: 12 });

    const picked = pickOne(variants);
    return mk(picked.q, picked.a, picked.spread);
  };

  const generateProblem = (diff, lvl, lang = 'en') => {
    const p = Math.random();
    if (lvl >= 40) {
      if (p < 0.07) return genModulo(diff, lvl);
      if (p < 0.14) return genLogic(diff, lvl, lang);
      if (p < 0.21) return genFractions(diff, lvl);
      if (p < 0.28) return genPrimes(diff, lvl, lang);
      if (p < 0.35) return genGeometry(diff, lvl, lang);
      if (p < 0.42) return genPercentage(diff, lvl, lang);
      if (p < 0.49) return genAlgebra(diff, lvl);
      if (p < 0.56) return genNumberRiddle(diff, lvl, lang);
      if (p < 0.63) return genWordProblem(diff, lvl, lang);
      if (p < 0.71) return genOpFix(diff, lvl);
      if (p < 0.79) return genDigitFix(diff, lvl);
      if (p < 0.88) return genArith(diff, lvl, lang);
      if (p < 0.95) return genPowers(diff, lvl);
      return genSequence(diff, lvl, lang);
    }
    if (lvl >= 10) {
      if (p < 0.05) return genModulo(diff, lvl);
      if (p < 0.10) return genLogic(diff, lvl, lang);
      if (p < 0.17) return genFractions(diff, lvl);
      if (p < 0.22) return genPrimes(diff, lvl, lang);
      if (p < 0.29) return genGeometry(diff, lvl, lang);
      if (p < 0.36) return genPercentage(diff, lvl, lang);
      if (p < 0.43) return genAlgebra(diff, lvl);
      if (p < 0.50) return genNumberRiddle(diff, lvl, lang);
      if (p < 0.57) return genWordProblem(diff, lvl, lang);
      if (p < 0.67) return genOpFix(diff, lvl);
      if (p < 0.77) return genDigitFix(diff, lvl);
      if (p < 0.88) return genArith(diff, lvl, lang);
      if (p < 0.95) return genPowers(diff, lvl);
      return genSequence(diff, lvl, lang);
    }
    if (p < 0.04) return genFractions(diff, lvl);
    if (p < 0.08) return genPrimes(diff, lvl, lang);
    if (p < 0.14) return genGeometry(diff, lvl, lang);
    if (p < 0.20) return genPercentage(diff, lvl, lang);
    if (p < 0.26) return genAlgebra(diff, lvl);
    if (p < 0.34) return genNumberRiddle(diff, lvl, lang);
    if (p < 0.42) return genWordProblem(diff, lvl, lang);
    if (p < 0.51) return genOpFix(diff, lvl);
    if (p < 0.61) return genDigitFix(diff, lvl);
    if (p < 0.76) return genArith(diff, lvl, lang);
    if (p < 0.90) return genPowers(diff, lvl);
    return genSequence(diff, lvl, lang);
  };

  const getSpecialFailOffer = () => {
    if (!account) return null;
    const reviveCost = getReviveCostOption(walletMeta);
    const alreadyUsedLife =
      walletMeta.lifeUsed ||
      (Array.isArray(walletMeta.walletEmojis) && walletMeta.walletEmojis.includes(WALLET_DECORATIONS.revive));

    if (alreadyUsedLife && reviveCost) {
      return { type: 'life', emoji: WALLET_DECORATIONS.revive, cost: reviveCost, alreadyUsed: true };
    }
    if (!alreadyUsedLife) {
      return { type: 'life', emoji: WALLET_DECORATIONS.revive, cost: reviveCost, alreadyUsed: false };
    }
    return null;
  };

  const getSpecialSuccessOffer = () => {
    if (!account) return null;
    // No "already owned" guard — NFTJis level up each time they drop
    const liveDice = getDiceState();
    const dm = liveDice.active ? liveDice.modifier : 0;
    if (Math.random() < (1 / 1000) * (1 + dm)) return { type: 'emoji1000', emoji: WALLET_DECORATIONS.lucky1000 };
    if (Math.random() < (1 / 500)  * (1 + dm)) return { type: 'emoji500',  emoji: WALLET_DECORATIONS.lucky500  };
    if (Math.random() < (1 / 100)  * (1 + dm)) return { type: 'emoji100',  emoji: WALLET_DECORATIONS.lucky100  };
    if (Math.random() < (1 / 50)   * (1 + dm)) return { type: 'emoji50',   emoji: WALLET_DECORATIONS.lucky50   };
    return null;
  };

  const persistResolvedFailure = async ({ choice, progressLevel, emoji = null, marketDelta = 0, consumeLife = false, reviveCost = null }) => {
    if (!account || !problem) return false;

    const wallet = account.toLowerCase();
    const [{ data: progressRow }, { data: tokenValueRow }] = await Promise.all([
      supabase
        .from('player_progress')
        .select('eur_earned, usd_earned, cny_earned, mm3_sold, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
        .eq('wallet', wallet)
        .maybeSingle(),
      marketDelta !== 0
        ? supabase.from('token_value').select('total_eth').limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const currentDecorations = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
    const nextDecorations = emoji ? appendWalletDecoration(currentDecorations, emoji) : currentDecorations;
    const nextFunds = {
      eur_earned: Number(progressRow?.eur_earned) || 0,
      usd_earned: Number(progressRow?.usd_earned) || 0,
      cny_earned: Number(progressRow?.cny_earned) || 0,
    };
    const soldMm3 = Number(progressRow?.mm3_sold) || 0;
    const liveSellQuote = getSellQuote(progressLevel, Math.max(0, totalMined - soldMm3));

    if (reviveCost) {
      nextFunds[reviveCost.field] = Math.max(0, nextFunds[reviveCost.field] - reviveCost.amount);
    }

    const gameInsert = {
      wallet,
      problem: problem.masked,
      user_answer: String(choice ?? ''),
      is_correct: false,
      time_ms: elapsedTime,
      mining_reward: 0,
      problem_id: problem.id || null,
      difficulty: problem.difficulty || getDiff(progressLevel),
      problem_type: problem.problem_type || 'arithmetic',
    };

    const { error: gameError } = await supabase.from('games').insert([gameInsert]);
    if (gameError) throw gameError;

    const progressPayload = {
      wallet,
      level: clampLevel(progressLevel),
      wallet_emojis: nextDecorations,
      life_used: consumeLife || Boolean(progressRow?.life_used),
      lucky_50_claimed: emoji === WALLET_DECORATIONS.lucky50 ? true : Boolean(progressRow?.lucky_50_claimed),
      lucky_100_claimed: emoji === WALLET_DECORATIONS.lucky100 ? true : Boolean(progressRow?.lucky_100_claimed),
      lucky_500_claimed: emoji === WALLET_DECORATIONS.lucky500 ? true : Boolean(progressRow?.lucky_500_claimed),
      lucky_1000_claimed: emoji === WALLET_DECORATIONS.lucky1000 ? true : Boolean(progressRow?.lucky_1000_claimed),
      lucky_50_level: Number(progressRow?.lucky_50_level ?? -1),
      lucky_100_level: Number(progressRow?.lucky_100_level ?? -1),
      lucky_500_level: Number(progressRow?.lucky_500_level ?? -1),
      lucky_1000_level: Number(progressRow?.lucky_1000_level ?? -1),
      sell_rate_cny: liveSellQuote.rateCny,
      sell_quote_cny: liveSellQuote.netCny,
      sell_quote_eur: liveSellQuote.netEur,
      sell_quote_usd: liveSellQuote.netUsd,
      updated_at: new Date().toISOString(),
      ...nextFunds,
    };

    const { error: progressError } = await supabase
      .from('player_progress')
      .update(progressPayload)
      .eq('wallet', wallet);
    if (progressError) throw progressError;

    if (marketDelta !== 0) {
      const totalMm3 = Number(tokenValueRow?.total_eth) || 0;
      const deltaMm3 = -Math.abs(totalMm3 * marketDelta);
      const { error: eventError } = await supabase
        .from('mm3_mining_events')
        .insert({
          wallet,
          event_type: MARKET_EVENT_TYPE_LIFE,
          delta_mm3: deltaMm3,
          emoji: emoji ?? WALLET_DECORATIONS.revive,
        });
      if (eventError) throw eventError;
    }

    setLevel(clampLevel(progressLevel));
    setWalletMeta((previous) => ({
      ...previous,
      eur: nextFunds.eur_earned,
      usd: nextFunds.usd_earned,
      cny: nextFunds.cny_earned,
      lifeUsed: consumeLife || Boolean(progressRow?.life_used),
      lucky50Claimed: emoji === WALLET_DECORATIONS.lucky50 ? true : Boolean(progressRow?.lucky_50_claimed),
      lucky100Claimed: emoji === WALLET_DECORATIONS.lucky100 ? true : Boolean(progressRow?.lucky_100_claimed),
      lucky500Claimed: emoji === WALLET_DECORATIONS.lucky500 ? true : Boolean(progressRow?.lucky_500_claimed),
      lucky1000Claimed: emoji === WALLET_DECORATIONS.lucky1000 ? true : Boolean(progressRow?.lucky_1000_claimed),
      walletEmojis: nextDecorations,
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem('lb_dirty_at', String(Date.now()));
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true } }));
    }

    return true;
  };

  const persistLifeRecovery = async ({ originalLevel, reviveCost }) => {
    if (!account) return false;
    const wallet = account.toLowerCase();
    const [{ data: progressRow }, { data: tokenValueRow }] = await Promise.all([
      supabase
        .from('player_progress')
        .select('eur_earned, usd_earned, cny_earned, mm3_sold, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
        .eq('wallet', wallet)
        .maybeSingle(),
      supabase.from('token_value').select('total_eth').limit(1).maybeSingle(),
    ]);

    const currentDecorations = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
    if (Boolean(progressRow?.life_used) || currentDecorations.includes(WALLET_DECORATIONS.revive)) {
      throw new Error('REVIVE_ALREADY_USED');
    }

    const nextFunds = {
      eur_earned: Number(progressRow?.eur_earned) || 0,
      usd_earned: Number(progressRow?.usd_earned) || 0,
      cny_earned: Number(progressRow?.cny_earned) || 0,
    };
    if (!reviveCost || nextFunds[reviveCost.field] < reviveCost.amount) {
      throw new Error('REVIVE_INSUFFICIENT_FUNDS');
    }
    nextFunds[reviveCost.field] = Math.max(0, nextFunds[reviveCost.field] - reviveCost.amount);

    const soldMm3 = Number(progressRow?.mm3_sold) || 0;
    const liveSellQuote = getSellQuote(originalLevel, Math.max(0, totalMined - soldMm3));

    const nextDecorations = appendWalletDecoration(currentDecorations, WALLET_DECORATIONS.revive);

    const progressPayload = {
      wallet,
      level: clampLevel(originalLevel),
      wallet_emojis: nextDecorations,
      life_used: true,
      lucky_50_claimed: Boolean(progressRow?.lucky_50_claimed),
      lucky_100_claimed: Boolean(progressRow?.lucky_100_claimed),
      lucky_500_claimed: Boolean(progressRow?.lucky_500_claimed),
      lucky_1000_claimed: Boolean(progressRow?.lucky_1000_claimed),
      lucky_50_level: Number(progressRow?.lucky_50_level ?? -1),
      lucky_100_level: Number(progressRow?.lucky_100_level ?? -1),
      lucky_500_level: Number(progressRow?.lucky_500_level ?? -1),
      lucky_1000_level: Number(progressRow?.lucky_1000_level ?? -1),
      sell_rate_cny: liveSellQuote.rateCny,
      sell_quote_cny: liveSellQuote.netCny,
      sell_quote_eur: liveSellQuote.netEur,
      sell_quote_usd: liveSellQuote.netUsd,
      updated_at: new Date().toISOString(),
      ...nextFunds,
    };

    const { error: progressError } = await supabase
      .from('player_progress')
      .update(progressPayload)
      .eq('wallet', wallet);
    if (progressError) throw progressError;

    const totalMm3 = Number(tokenValueRow?.total_eth) || 0;
    const deltaMm3 = -Math.abs(totalMm3 * 0.25);
    const { error: eventError } = await supabase
      .from('mm3_mining_events')
      .insert({ wallet, event_type: MARKET_EVENT_TYPE_LIFE, delta_mm3: deltaMm3, emoji: WALLET_DECORATIONS.revive });
    if (eventError) throw eventError;

    setLevel(clampLevel(originalLevel));
    setWalletMeta((prev) => ({
      ...prev,
      eur: nextFunds.eur_earned,
      usd: nextFunds.usd_earned,
      cny: nextFunds.cny_earned,
      lifeUsed: true,
      walletEmojis: nextDecorations,
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem('lb_dirty_at', String(Date.now()));
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true } }));
    }
    return true;
  };

  const persistWalletEmojiClaim = async ({ emoji, progressLevel, nextTotalMined }) => {
    if (!account || !emoji) return false;

    const wallet = account.toLowerCase();
    const [{ data: progressRow }, { data: tokenValueRow }] = await Promise.all([
      supabase
        .from('player_progress')
        .select('level, eur_earned, usd_earned, cny_earned, mm3_sold, wallet_emojis, life_used, lucky_50_claimed, lucky_100_claimed, lucky_500_claimed, lucky_1000_claimed, lucky_50_level, lucky_100_level, lucky_500_level, lucky_1000_level')
        .eq('wallet', wallet)
        .maybeSingle(),
      supabase.from('token_value').select('total_eth').limit(1).maybeSingle(),
    ]);

    const currentDecorations = Array.isArray(progressRow?.wallet_emojis) ? progressRow.wallet_emojis : [];
    const alreadyOwned = currentDecorations.includes(emoji);
    const nextDecorations = appendWalletDecoration(currentDecorations, emoji);
    const soldMm3 = Number(progressRow?.mm3_sold) || 0;
    const effectiveLevel = clampLevel(Math.max(Number(progressRow?.level) || 0, progressLevel || 0));
    const liveSellQuote = getSellQuote(effectiveLevel, Math.max(0, Number(nextTotalMined) - soldMm3));

    const progressPayload = {
      wallet,
      level: effectiveLevel,
      mm3_sold: soldMm3,
      cny_earned: Number(progressRow?.cny_earned) || 0,
      eur_earned: Number(progressRow?.eur_earned) || 0,
      usd_earned: Number(progressRow?.usd_earned) || 0,
      wallet_emojis: nextDecorations,
      life_used: Boolean(progressRow?.life_used),
      lucky_50_claimed: emoji === WALLET_DECORATIONS.lucky50 ? true : Boolean(progressRow?.lucky_50_claimed),
      lucky_100_claimed: emoji === WALLET_DECORATIONS.lucky100 ? true : Boolean(progressRow?.lucky_100_claimed),
      lucky_500_claimed: emoji === WALLET_DECORATIONS.lucky500 ? true : Boolean(progressRow?.lucky_500_claimed),
      lucky_1000_claimed: emoji === WALLET_DECORATIONS.lucky1000 ? true : Boolean(progressRow?.lucky_1000_claimed),
      lucky_50_level: emoji === WALLET_DECORATIONS.lucky50
        ? Number(progressRow?.lucky_50_level ?? -1) + 1 : Number(progressRow?.lucky_50_level ?? -1),
      lucky_100_level: emoji === WALLET_DECORATIONS.lucky100
        ? Number(progressRow?.lucky_100_level ?? -1) + 1 : Number(progressRow?.lucky_100_level ?? -1),
      lucky_500_level: emoji === WALLET_DECORATIONS.lucky500
        ? Number(progressRow?.lucky_500_level ?? -1) + 1 : Number(progressRow?.lucky_500_level ?? -1),
      lucky_1000_level: emoji === WALLET_DECORATIONS.lucky1000
        ? Number(progressRow?.lucky_1000_level ?? -1) + 1 : Number(progressRow?.lucky_1000_level ?? -1),
      sell_rate_cny: liveSellQuote.rateCny,
      sell_quote_cny: liveSellQuote.netCny,
      sell_quote_eur: liveSellQuote.netEur,
      sell_quote_usd: liveSellQuote.netUsd,
      updated_at: new Date().toISOString(),
    };

    const { error: progressError } = await supabase
      .from('player_progress')
      .update(progressPayload)
      .eq('wallet', wallet);
    if (progressError) throw progressError;

    const marketDelta = getWalletMarketDelta(emoji);
    if (!alreadyOwned && marketDelta !== 0) {
      const totalMm3 = Number(tokenValueRow?.total_eth) || 0;
      const deltaMm3 = Math.abs(totalMm3 * marketDelta);
      const { error: eventError } = await supabase
        .from('mm3_mining_events')
        .insert({
          wallet,
          event_type: MARKET_EVENT_TYPE_NFTJI,
          delta_mm3: deltaMm3,
          emoji,
        });
      if (eventError) {
        console.error('nftji market event insert:', eventError);
      }
    }

    setWalletMeta((previous) => ({
      ...previous,
      eur: progressPayload.eur_earned,
      usd: progressPayload.usd_earned,
      cny: progressPayload.cny_earned,
      lifeUsed: progressPayload.life_used,
      lucky50Claimed: progressPayload.lucky_50_claimed,
      lucky100Claimed: progressPayload.lucky_100_claimed,
      lucky500Claimed: progressPayload.lucky_500_claimed,
      lucky1000Claimed: progressPayload.lucky_1000_claimed,
      lucky50Level: progressPayload.lucky_50_level,
      lucky100Level: progressPayload.lucky_100_level,
      lucky500Level: progressPayload.lucky_500_level,
      lucky1000Level: progressPayload.lucky_1000_level,
      walletEmojis: nextDecorations,
    }));

    if (typeof window !== 'undefined') {
      localStorage.setItem('lb_dirty_at', String(Date.now()));
      window.dispatchEvent(new CustomEvent('mm3-db-updated', { detail: { wallet, special: true } }));
    }

    return true;
  };

  const fetchFromDB = async (diff, lang = 'en') => {
    try {
      const { data: rows, error } = await supabase
        .from('math_problems')
        .select('*')
        .eq('difficulty', diff)
        .eq('language', lang)
        .limit(20);
      let pool = !error && rows?.length ? rows : null;
      if (!pool && lang !== 'en') {
        const { data: fallback } = await supabase
          .from('math_problems').select('*')
          .eq('difficulty', diff).eq('language', 'en').limit(20);
        pool = fallback?.length ? fallback : null;
      }
      if (!pool) return null;
      const data = localizeDbProblemRow(pool[Math.floor(Math.random() * pool.length)], lang);
      if (data.is_definition_type || data.problem_type === 'definition') {
        return {
          id: data.id,
          type: 'definition',
          problem_type: 'definition',
          question: data.question,
          answer: data.correct_answer.toLowerCase(),
          masked: data.question,
          placeholder: lang === 'es' ? 'tu respuesta' : 'your answer',
          choices: data.answer_options || [],
          difficulty: data.difficulty,
          base_points: data.base_points,
          sourceQuestion: data.source_question || data.question,
          sourceAnswer: data.source_answer || data.correct_answer,
          sourceChoices: data.source_choices || data.answer_options || [],
        };
      }
      return {
        id: data.id,
        type: data.problem_type,
        problem_type: data.problem_type,
        question: data.question,
        answer: String(data.correct_answer).toLowerCase(),
        masked: data.question,
        placeholder: '?',
        choices: data.answer_options || [],
        difficulty: data.difficulty,
        base_points: data.base_points,
        sourceQuestion: data.source_question || data.question,
      };
    } catch {
      return null;
    }
  };

  const fetchPhrase = async (forceLevel, autoStart = false) => {
    const lvl = forceLevel !== undefined ? forceLevel : level;
    setIsRefreshing(true);
    clearGameplayTimers();
    solveStartedAtRef.current = null;
    try {
      const diff = getDiff(lvl);
      const shouldGenerate = lvl >= 20 || Math.random() < 0.55;
      let nextProblem = shouldGenerate ? generateProblem(diff, lvl, language) : await fetchFromDB(diff, language);
      if (!nextProblem) nextProblem = generateProblem(diff, lvl, language);

      setProblem(nextProblem);
      writeCachedProblem(nextProblem, lvl);
      setElapsedTime(0);
      setPreGameCountdown(999);
      setIsDisabled(true);
      setGameCompletedLocal(false);
      setGameCompleted(false);
      setPostFailOffer(null);
      setPostSuccessOffer(null);
      setIsResolvingFail(false);
      setIsClaimingSuccess(false);
      setGameMessage('');
      setPreGameLine(PRE_GAME_LINES[randInt(0, PRE_GAME_LINES.length - 1)]);

      if (!autoStart) {
        // Fresh load (initial mount or login): show appropriate button
        setIsAwaitingStart(lvl === 0);
        setIsAwaitingContinue(lvl > 0);
      } else {
        // Triggered by a user click (Next Block / Start): auto-start countdown
        setIsAwaitingStart(false);
        setIsAwaitingContinue(false);
        setPreGameCountdown(3);
        preRef.current = setInterval(() => {
          setPreGameCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(preRef.current);
              startSolveTimer();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      refreshUiTimeoutRef.current = setTimeout(() => {
        setIsRefreshing(false);
        refreshUiTimeoutRef.current = null;
      }, 300);
    }
  };

  const notifyGuestMining = () => {
    if (!account && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg: t('board.guestNotice'), type: 'info' } }));
    }
  };

  const startCountdown = () => {
    if (noSlotsLeft) return;
    clearBoardFeedback();
    notifyGuestMining();
    clearGameplayTimers();
    solveStartedAtRef.current = null;
    setIsAwaitingStart(false);
    setIsAwaitingContinue(false);
    setPreGameCountdown(3);

    preRef.current = setInterval(() => {
      setPreGameCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(preRef.current);
          startSolveTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startNextBlock = () => {
    if (noSlotsLeft) return;
    clearBoardFeedback();
    notifyGuestMining();
    fetchPhrase(undefined, true);
  };

  const startSolveTimer = () => {
    setIsDisabled(false);
    solveStartedAtRef.current = Date.now();
    solveRef.current = setInterval(() => {
      const passed = Date.now() - solveStartedAtRef.current;
      setElapsedTime(passed);
      if (passed >= getTimeLimit(level)) {
        clearInterval(solveRef.current);
        solveRef.current = null;
        showMessage(t('board.timeExceeded'), 'info', true);
        handleWrong(null);
      }
    }, 100);
  };

  const checkAnswer = async (choice) => {
    if (!problem || isDisabled || noSlotsLeft) return;

    clearInterval(solveRef.current);
    solveRef.current = null;
    const totalTime = solveStartedAtRef.current
      ? Date.now() - solveStartedAtRef.current
      : elapsedTime;
    setElapsedTime(totalTime);
    const correct = String(choice).trim().toLowerCase() === problem.answer.trim().toLowerCase();

    if (correct) {
      clearWrongFeedback();
      playSuccess();
      const timeLimit = getTimeLimit(level);
      const base = timeLimit * 0.5;
      let mining = totalTime <= base
        ? PRICE * ((base - totalTime) / base)
        : -PRICE * 0.05 * Math.min((totalTime - base) / base, 1);
      mining *= getRewardMult(level);

      const newLevel = clampLevel(level + (level >= 80 ? 2 : 1));
      const nextTotalMined = totalMined + mining;
      const successOffer = getSpecialSuccessOffer();
      const prevTier = getRankTier(level);
      const nextTier = getRankTier(newLevel);
      const tierUp = prevTier.label !== nextTier.label;
      if (tierUp) playTierUp();
      if (successOffer) playNftDrop();

      setLevel(newLevel);
      setTotalMined(nextTotalMined);
      setLevelFlash('up');
      setCorrectFeedbackActive(true);
      levelFlashTimeoutRef.current = setTimeout(() => {
        setLevelFlash(null);
        levelFlashTimeoutRef.current = null;
      }, 500);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mm3-correct', { detail: { reward: mining, mm3: mining / PRICE } }));
      }

      const amount = Math.abs(mining) < 1e-8 ? '<0.00000001' : mining.toFixed(8);
      const speedTag = totalTime < 1000 ? ` ${Math.round(totalTime)}ms` : '';
      showMessage(
        `${tierUp ? `🔥 ${nextTier.emoji} ${nextTier.label}! ` : ''}${account ? t('board.injectMM3') : `${t('board.guestResult')} · ${t('board.connectToInject')}`}: ${amount} MM3${speedTag}${successOffer ? ` · ${t('board.nftFound')}` : ''}`,
        'success'
      );
      setPostSuccessOffer(successOffer ? { progressLevel: newLevel, nextTotalMined, offer: successOffer } : null);
      finalizeGame(true, mining, choice, newLevel);
      return;
    }

    handleWrong(choice);
  };

  const handleWrong = async (choice) => {
    playFailure();
    const penalty = level >= 70 ? 5 : level >= 40 ? 3 : level >= 15 ? 2 : 1;
    const newLevel = clampLevel(level - penalty);
    const offer = getSpecialFailOffer();
    const canShowRevive = offer?.type === 'life' && !!offer.cost;

    clearCorrectFeedback();
    setLevelFlash('down');
    setWrongFeedbackActive(true);
    levelFlashTimeoutRef.current = setTimeout(() => {
      setLevelFlash(null);
      levelFlashTimeoutRef.current = null;
    }, 800);
    setIsDisabled(true);
    setGameCompletedLocal(true);
    setGameCompleted(true);
    setPostSuccessOffer(null);
    // Only show revive panel when user actually has funds for it; used lives show as disabled.
    setPostFailOffer(canShowRevive ? { choice, originalLevel: level, penalizedLevel: newLevel, offer } : null);
    showMessage(t('board.chainBroken'), 'error', true);

    // Always apply penalty immediately
    setLevel(newLevel);
    if (account) {
      try {
        await persistResolvedFailure({ choice, progressLevel: newLevel });
      } catch (error) {
        console.error('standard failure resolve:', error);
        showMessage(t('board.claimFailed'), 'error', true);
      }
    }
  };

  const continueAfterResolution = async () => {
    clearBoardFeedback();
    notifyGuestMining();
    setGameCompleted(false);
    setGameCompletedLocal(false);
    setPostFailOffer(null);
    setGameMessage('');
    await fetchPhrase(undefined, true);
  };

  const handleFailureContinue = async () => {
    if (isResolvingFail) return;
    await continueAfterResolution();
  };

  const handleSpecialClaim = async () => {
    if (!postFailOffer?.offer || isResolvingFail) return;

    const { offer } = postFailOffer;
    if (offer.type !== 'life' || !offer.cost || offer.alreadyUsed) return;

    clearBoardFeedback();
    const originalLevel = postFailOffer.originalLevel;
    setIsResolvingFail(true);
    try {
      await persistLifeRecovery({ originalLevel, reviveCost: offer.cost });
      showMessage(`${t('board.reviveSuccess')} ${t('board.lifeCost')}`, 'success', true);
      // Reset game state without auto-starting countdown — show Next Block
      setGameCompleted(false);
      setGameCompletedLocal(false);
      setPostFailOffer(null);
      setGameMessage('');
      await fetchPhrase(clampLevel(originalLevel), false);
    } catch (error) {
      console.error('special claim:', error);
      showMessage(error?.message === 'REVIVE_ALREADY_USED' ? t('board.reviveAlreadyUsed') : t('board.reviveFailed'), 'error', true);
    } finally {
      setIsResolvingFail(false);
    }
  };

  const handleSuccessClaim = async () => {
    if (!postSuccessOffer?.offer || isClaimingSuccess) return;

    const claimedOffer = postSuccessOffer.offer;
    setIsClaimingSuccess(true);
    try {
      if (claimedOffer.type === 'emoji50') {
        await persistWalletEmojiClaim({
          emoji: WALLET_DECORATIONS.lucky50,
          progressLevel: postSuccessOffer.progressLevel,
          nextTotalMined: postSuccessOffer.nextTotalMined,
        });
        showMessage(t('board.lucky50Success'), 'success', true);
      } else if (claimedOffer.type === 'emoji100') {
        await persistWalletEmojiClaim({
          emoji: WALLET_DECORATIONS.lucky100,
          progressLevel: postSuccessOffer.progressLevel,
          nextTotalMined: postSuccessOffer.nextTotalMined,
        });
        showMessage(t('board.lucky100Success'), 'success', true);
      } else if (claimedOffer.type === 'emoji500') {
        await persistWalletEmojiClaim({
          emoji: WALLET_DECORATIONS.lucky500,
          progressLevel: postSuccessOffer.progressLevel,
          nextTotalMined: postSuccessOffer.nextTotalMined,
        });
        showMessage(t('board.lucky500Success'), 'success', true);
      } else if (claimedOffer.type === 'emoji1000') {
        await persistWalletEmojiClaim({
          emoji: WALLET_DECORATIONS.lucky1000,
          progressLevel: postSuccessOffer.progressLevel,
          nextTotalMined: postSuccessOffer.nextTotalMined,
        });
        showMessage(t('board.lucky1000Success'), 'success', true);
      }
      setPostSuccessOffer(null);
    } catch (error) {
      console.error('success claim:', error);
      showMessage(t('board.claimFailed'), 'error', true);
    } finally {
      setIsClaimingSuccess(false);
    }
  };

  const finalizeGame = (isCorrect, mining, choice, newLevel) => {
    setIsDisabled(true);
    setGameCompletedLocal(true);
    setGameCompleted(true);
    setGameData({
      wallet: account,
      problem: problem?.masked,
      user_answer: String(choice ?? ''),
      is_correct: isCorrect,
      time_ms: elapsedTime,
      mining_reward: mining,
      problem_id: problem?.id || null,
      difficulty: problem?.difficulty || getDiff(newLevel),
      problem_type: problem?.problem_type || 'arithmetic',
      progress_level: clampLevel(newLevel),
    });
  };

  const showMessage = (msg, type = 'info', toastOnly = false) => {
    if (!toastOnly) setGameMessage(msg);
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('mm3-toast', { detail: { msg, type } }));
  };

  const tier = getRankTier(level);
  const timeLimit = getTimeLimit(level);
  const timePct = preGameCountdown === 0 ? Math.min((elapsedTime / timeLimit) * 100, 100) : 0;
  const timeColor = timePct > 80 ? '#ef4444' : timePct > 55 ? '#f97316' : tier.color;
  const boardAlertColor = wrongFeedbackActive ? '#fb7185' : correctFeedbackActive ? '#4ade80' : tier.color;

  const currentFunds = walletMeta[currency.toLowerCase()] ?? 0;
  const dailyMineTotal = DAILY_MINE_BASE + execsCount;
  const dailyMineLeft = Math.max(0, dailyMineTotal - dailyMineUsed);
  const noSlotsLeft = !!account && dailyMineLeft <= 0;
  const problemFamilyLabel = getProblemFamilyLabel(problem, language);
  const walletNftjis = Array.isArray(walletMeta.nftjis) ? walletMeta.nftjis : [];
  const displayedNftjis = account ? walletNftjis : ANON_NFTJI_SLOTS;

  return (
    <>
      <style>{`
        @keyframes flash-up   { 0%,100%{opacity:1} 50%{filter:brightness(2) saturate(1.5)} }
        @keyframes flash-down { 0%,100%{opacity:1} 30%{opacity:.35;filter:brightness(.4)} }
        .level-up   { animation: flash-up   .5s ease-in-out; }
        .level-down { animation: flash-down .8s ease-in-out; }
        .mm3-question-family {
          backdrop-filter: blur(6px);
          max-width: min(44%, 9.5rem);
        }
        @media (max-width: 420px) {
          .mm3-question-family {
            max-width: 7.5rem;
          }
        }
      `}</style>

      <div className="w-full">
        <div className="mx-auto max-w-lg px-2">

          <div className="relative left-1/2 mb-2 flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-md border border-cyan-500/15 bg-black/70 px-2 py-1.5">
              {displayedNftjis.length ? displayedNftjis.map((nftji) => {
                const isMining = nftji.source === 'mining';
                const isLife = nftji.emoji === WALLET_DECORATIONS.revive;
                const borderColor = nftji.placeholder
                  ? (isMining ? 'rgba(250,204,21,0.22)' : isLife ? 'rgba(251,113,133,0.22)' : 'rgba(148,163,184,0.22)')
                  : (isMining ? 'rgba(250,204,21,0.6)' : isLife ? 'rgba(251,113,133,0.6)' : tier.glow);
                const slotColor = isMining ? '#fef08a' : tier.color;
                const title = nftji.placeholder
                  ? (nftji.source === 'mining' ? 'Mining NFTJI — none' : `${getEmojiTitle(nftji.emoji)} — none`)
                  : `${getEmojiTitle(nftji.emoji)}${nftji.blockKey ? ` | ${nftji.blockKey}` : ''} | Lv.${nftji.level}`;
                return (
                  <div
                    key={nftji.key}
                    className="mm3-trade-slot flex h-[58px] w-11 flex-none flex-col items-center justify-center rounded-md border"
                    style={{
                      borderColor,
                      background: nftji.placeholder ? 'rgba(2,6,23,0.4)' : (isLife ? '#100b18' : tier.bg),
                      color: nftji.placeholder ? 'rgba(100,116,139,0.35)' : slotColor,
                      boxShadow: nftji.placeholder ? 'none' : (isMining ? '0 0 12px rgba(250,204,21,0.25)' : `0 0 12px ${tier.color}22`),
                    }}
                    title={title}
                  >
                    {!nftji.placeholder && <span className="text-[1.05rem] leading-none">{nftji.emoji}</span>}
                    {!nftji.placeholder && <span className="mt-0.5 font-mono text-[0.52rem] font-black leading-none">Lv{nftji.level}</span>}
                  </div>
                );
              }) : (
                <span className="font-mono text-[0.52rem] uppercase tracking-[0.14em] text-slate-700">NONE</span>
              )}
          </div>

          {/* Drill slots — standalone widget */}
          {account && (
            <div className="flex justify-center mb-3">
              <div
                className={`inline-flex flex-col items-center rounded-xl border px-6 py-2.5 ${levelFlash === 'up' ? 'level-up' : levelFlash === 'down' ? 'level-down' : ''}`}
                style={{
                  background: noSlotsLeft ? 'rgba(251,113,133,0.05)' : 'rgba(0,0,0,0.7)',
                  borderColor: noSlotsLeft ? '#fb718555' : tier.color + '35',
                  boxShadow: noSlotsLeft ? '0 0 18px rgba(251,113,133,0.12)' : `0 0 18px ${tier.color}14`,
                }}
                title={`${t('board.drillSlots')}: ${dailyMineLeft}/${dailyMineTotal} · base 100 + ${execsCount} EXECs`}
              >
                <div
                  className="text-[0.60rem] font-mono uppercase tracking-[0.18em] mb-1 leading-none"
                  style={{ color: noSlotsLeft ? '#fb7185aa' : tier.color + 'aa' }}
                >
                  {t('board.drillSlots')}
                </div>
                <div
                  className="text-[1.15rem] font-black font-mono leading-none"
                  style={{ color: noSlotsLeft ? '#fb7185' : tier.color }}
                >
                  #{dailyMineLeft.toString(16).toUpperCase()}/{execsCount > 0 ? `100+#${execsCount.toString(16).toUpperCase()}` : '#64'}
                </div>
              </div>
            </div>
          )}

          {problem && (
            <>
              <div
                className={`relative rounded-xl border-2 p-4 transition-colors duration-300 ${wrongFeedbackActive ? 'mm3-board-wrong-alert' : correctFeedbackActive ? 'mm3-board-correct-alert' : ''}`}
                style={{
                  borderColor: wrongFeedbackActive ? '#fb7185' : correctFeedbackActive ? '#4ade80' : levelFlash === 'down' ? '#ef444470' : tier.color + '40',
                  background: wrongFeedbackActive
                    ? 'rgba(24, 5, 8, 0.96)'
                    : correctFeedbackActive
                      ? 'rgba(2, 18, 8, 0.96)'
                    : '#000',
                  boxShadow: wrongFeedbackActive
                    ? '0 0 28px rgba(251,113,133,.45), inset 0 0 26px rgba(127,29,29,.26)'
                    : correctFeedbackActive
                      ? '0 0 28px rgba(74,222,128,.38), inset 0 0 26px rgba(20,83,45,.24)'
                    : `0 0 24px ${tier.color}12`,
                }}
              >
                {/* CRT scanlines */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none opacity-40"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0,rgba(0,0,0,.2) 1px,transparent 1px,transparent 2px)',
                  }}
                />

                {/* Question */}
                {shouldShowProblem && (
                  <div className="relative z-10 text-center mb-4">
                    <span
                      className="mm3-question-family absolute -top-3 right-0 truncate rounded border px-1.5 py-0.5 text-[0.54rem] font-black uppercase tracking-[0.14em]"
                      style={{
                        borderColor: `${boardAlertColor}40`,
                        background: 'rgba(2,6,23,0.72)',
                        color: `${boardAlertColor}cc`,
                        boxShadow: `0 0 10px ${boardAlertColor}16`,
                      }}
                      title={problemFamilyLabel}
                    >
                      {problemFamilyLabel}
                    </span>
                    <p
                      className="text-xl sm:text-2xl font-mono font-black tracking-wide break-words leading-tight"
                      style={{ color: boardAlertColor, textShadow: `0 0 16px ${boardAlertColor}50` }}
                    >
                      {problem.question}
                    </p>
                  </div>
                )}

                {/* Status zone: countdown / start / next-block / time bar — fixed position */}
                <div className="relative z-10 mb-4 flex flex-col items-center justify-center" style={{ minHeight: '3.5rem' }}>
                  {preGameCountdown > 0 && preGameCountdown < 999 ? (
                    <div className="text-center">
                      <div
                        className="text-5xl font-black font-mono leading-none"
                        style={{ color: tier.color, textShadow: `0 0 24px ${tier.color}` }}
                      >
                        {preGameCountdown}
                      </div>
                      <p className="text-[0.6rem] font-mono mt-1 tracking-widest" style={{ color: tier.color + 'aa' }}>
                        {preGameLine || t('board.getReady')}
                      </p>
                    </div>
                  ) : isAwaitingStart ? (
                    <button
                      onClick={startCountdown}
                      disabled={isRefreshing || noSlotsLeft}
                      aria-label="Start game"
                      className="px-8 py-2 rounded-lg font-mono text-sm uppercase tracking-[0.2em] border-2 transition-all duration-200 focus:outline-none"
                      style={{
                        borderColor: noSlotsLeft ? '#fb718565' : tier.color + '65',
                        color: noSlotsLeft ? '#fb7185' : tier.color,
                        background: 'transparent',
                        cursor: (isRefreshing || noSlotsLeft) ? 'not-allowed' : 'pointer',
                        opacity: (isRefreshing || noSlotsLeft) ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => !isRefreshing && !noSlotsLeft && Object.assign(e.currentTarget.style, {
                        background: tier.color + '14',
                        boxShadow: `0 0 16px ${tier.color}40`,
                        transform: 'translateY(-1px)',
                      })}
                      onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
                        background: 'transparent',
                        boxShadow: 'none',
                        transform: 'none',
                      })}
                    >
                      {isRefreshing ? `⟳ ${t('board.loading')}` : noSlotsLeft ? t('board.noSlots') : `▶ ${t('board.startGame')}`}
                    </button>
                  ) : isAwaitingContinue ? (
                    <button
                      onClick={startNextBlock}
                      disabled={isRefreshing || noSlotsLeft}
                      aria-label="Next round"
                      className="px-8 py-2 rounded-lg font-mono text-sm uppercase tracking-[0.2em] border-2 transition-all duration-200 focus:outline-none"
                      style={{
                        borderColor: noSlotsLeft ? '#fb718565' : tier.color + '65',
                        color: noSlotsLeft ? '#fb7185' : tier.color,
                        background: 'transparent',
                        cursor: (isRefreshing || noSlotsLeft) ? 'not-allowed' : 'pointer',
                        opacity: (isRefreshing || noSlotsLeft) ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => !isRefreshing && !noSlotsLeft && Object.assign(e.currentTarget.style, {
                        background: tier.color + '14',
                        boxShadow: `0 0 16px ${tier.color}40`,
                        transform: 'translateY(-1px)',
                      })}
                      onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
                        background: 'transparent',
                        boxShadow: 'none',
                        transform: 'none',
                      })}
                    >
                      {isRefreshing ? `⟳ ${t('board.loading')}` : noSlotsLeft ? t('board.noSlots') : `▶ ${t('board.nextRound')}`}
                    </button>
                  ) : preGameCountdown === 0 ? (
                    <div className="w-full px-0.5">
                      <div className="flex justify-between text-[0.82rem] font-mono mb-0.5">
                        <span style={{ color: timeColor }}>⏱ {elapsedTime}ms</span>
                        <span style={{ color: tier.color + '55' }}>{(timeLimit / 1000).toFixed(1)}s</span>
                      </div>
                      <div className="w-full h-1 bg-black/70 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${100 - timePct}%`,
                            background: timeColor,
                            boxShadow: `0 0 6px ${timeColor}`,
                            transition: 'background .3s, width .05s linear',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={startNextBlock}
                      disabled={isRefreshing || noSlotsLeft}
                      aria-label="Next round"
                      className="px-8 py-2 rounded-lg font-mono text-sm uppercase tracking-[0.2em] border-2 transition-all duration-200 focus:outline-none"
                      style={{
                        borderColor: noSlotsLeft ? '#fb718565' : tier.color + '65',
                        color: noSlotsLeft ? '#fb7185' : tier.color,
                        background: 'transparent',
                        cursor: (isRefreshing || noSlotsLeft) ? 'not-allowed' : 'pointer',
                        opacity: (isRefreshing || noSlotsLeft) ? 0.5 : 1,
                      }}
                    >
                      {isRefreshing ? `⟳ ${t('board.loading')}` : noSlotsLeft ? t('board.noSlots') : `▶ ${t('board.nextRound')}`}
                    </button>
                  )}
                </div>

                {/* Answer choices */}
                {shouldShowProblem && (
                  <div className="relative z-10">
                    {problem.type === 'definition' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {problem.choices.map((choice, idx) => (
                          <button
                            key={idx}
                            onClick={() => checkAnswer(choice)}
                            disabled={isDisabled}
                            aria-label={`Answer: ${choice}`}
                            className="px-3 py-2 rounded-lg font-mono text-xs sm:text-sm font-bold text-left border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            style={{
                              borderColor: isDisabled ? '#1f293740' : tier.color + '38',
                              color: isDisabled ? '#37415180' : '#e2e8f0',
                              background: '#000',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => !isDisabled && Object.assign(e.currentTarget.style, {
                              borderColor: tier.color,
                              background: tier.color + '0f',
                              boxShadow: `0 0 14px ${tier.color}40`,
                              transform: 'translateY(-1px)',
                            })}
                            onMouseLeave={(e) => !isDisabled && Object.assign(e.currentTarget.style, {
                              borderColor: tier.color + '38',
                              background: '#000',
                              boxShadow: 'none',
                              transform: 'none',
                            })}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {problem.choices.map((choice, idx) => (
                          <button
                            key={idx}
                            onClick={() => checkAnswer(choice)}
                            disabled={isDisabled}
                            aria-label={`Answer: ${choice}`}
                            className="py-2.5 rounded-lg font-mono text-base sm:text-lg font-black uppercase border-2 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            style={{
                              borderColor: isDisabled ? '#1f293740' : tier.color + '38',
                              color: isDisabled ? '#37415180' : tier.color,
                              background: '#000',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                            }}
                            onMouseEnter={(e) => !isDisabled && Object.assign(e.currentTarget.style, {
                              borderColor: tier.color,
                              background: tier.color + '12',
                              boxShadow: `0 0 18px ${tier.color}50`,
                              transform: 'translateY(-2px)',
                            })}
                            onMouseLeave={(e) => !isDisabled && Object.assign(e.currentTarget.style, {
                              borderColor: tier.color + '38',
                              background: '#000',
                              boxShadow: 'none',
                              transform: 'none',
                            })}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {postFailOffer?.offer && (
                  <div className="relative z-10 mt-5 rounded-lg border p-3 text-center" style={{ borderColor: tier.glow, background: tier.bg }}>
                    <div className="text-xs leading-relaxed text-slate-300">
                      {postFailOffer.offer.type === 'life'
                        ? postFailOffer.offer.alreadyUsed
                          ? t('board.reviveAlreadyUsedFreak')
                          : t('board.reviveHint')
                        : postFailOffer.offer.type === 'emoji500'
                          ? t('board.luck500Hint')
                          : t('board.luck100Hint')}
                    </div>
                    {postFailOffer.offer.type === 'life' && !postFailOffer.offer.alreadyUsed && (
                      <div className="mt-2 text-[0.90rem] font-mono text-amber-200/80">{t('board.lifeCost')}</div>
                    )}
                  </div>
                )}

                {postSuccessOffer?.offer && (
                  <div className="relative z-10 mt-5 rounded-lg border p-3 text-center" style={{ borderColor: tier.glow, background: tier.bg }}>
                    <div className="text-xs leading-relaxed text-slate-300">
                      {postSuccessOffer.offer.type === 'emoji1000'
                        ? t('board.luck1000Hint')
                        : postSuccessOffer.offer.type === 'emoji500'
                          ? t('board.luck500Hint')
                        : postSuccessOffer.offer.type === 'emoji100'
                          ? t('board.luck100Hint')
                          : t('board.luck50Hint')}
                    </div>
                  </div>
                )}

                {gameCompletedLocal && (
                  <div className="relative z-10 mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    {postFailOffer?.offer && (
                      <button
                        onClick={handleSpecialClaim}
                        disabled={isResolvingFail || (postFailOffer.offer.type === 'life' && (!postFailOffer.offer.cost || postFailOffer.offer.alreadyUsed))}
                        title={postFailOffer.offer.alreadyUsed ? t('board.reviveAlreadyUsedFreak') : undefined}
                        aria-label="Special action"
                        className="min-w-14 px-4 py-2.5 rounded-lg font-mono text-2xl leading-none border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40"
                        style={{
                          borderColor: postFailOffer.offer.type === 'life' ? '#fb7185aa' : '#facc15aa',
                          color: postFailOffer.offer.type === 'life' ? '#fb7185' : '#facc15',
                          background: 'transparent',
                        }}
                      >
                        {isResolvingFail
                          ? t('board.loading')
                          : postFailOffer.offer.cost ? t('board.reviveButton') : t('board.reviveDisabled')}
                      </button>
                    )}

                    {postSuccessOffer?.offer && (
                      <button
                        onClick={handleSuccessClaim}
                        disabled={isClaimingSuccess}
                        aria-label="Claim NFTJI"
                        className="min-w-14 px-4 py-2.5 rounded-lg font-mono text-2xl leading-none border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-40"
                        style={{
                          borderColor: '#facc15aa',
                          color: '#facc15',
                          background: 'transparent',
                        }}
                      >
                        {isClaimingSuccess
                          ? t('board.loading')
                          : postSuccessOffer.offer.type === 'emoji1000'
                            ? t('board.claimLucky1000')
                            : postSuccessOffer.offer.type === 'emoji500'
                              ? t('board.claimLucky500')
                              : postSuccessOffer.offer.type === 'emoji100'
                                ? t('board.claimLucky100')
                                : t('board.claimLucky50')}
                      </button>
                    )}

                    <button
                      onClick={postFailOffer ? handleFailureContinue : startNextBlock}
                      disabled={isRefreshing || isResolvingFail || isClaimingSuccess}
                      aria-label="Next round"
                      className="px-8 py-2.5 rounded-lg font-mono text-sm uppercase tracking-[0.2em] border-2 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                      style={{
                        borderColor: tier.color + '65',
                        color: tier.color,
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => Object.assign(e.currentTarget.style, {
                        background: tier.color + '14',
                        boxShadow: `0 0 16px ${tier.color}40`,
                        transform: 'translateY(-1px)',
                      })}
                      onMouseLeave={(e) => Object.assign(e.currentTarget.style, {
                        background: 'transparent',
                        boxShadow: 'none',
                        transform: 'none',
                      })}
                    >
                      {isRefreshing || isResolvingFail || isClaimingSuccess
                        ? `⟳ ${t('board.loading')}`
                        : `▶ ${t('board.nextRound')}`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </>
  );
}
