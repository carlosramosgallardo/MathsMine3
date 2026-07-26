package xyz.mathsmine3.nativeapp.training

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.random.Random

data class TrainingProblem(
    val question: String,
    val answer: String,
    val choices: List<String>,
    val difficulty: Int,
    val problemType: String,
    val masked: String = question,
    val id: String? = null,
)

object TrainingRules {
    const val DAILY_MINE_BASE = 100
    private const val PRICE = 0.00001

    fun getDiff(level: Int): Int = when {
        level >= 70 -> 5
        level >= 40 -> 4
        level >= 20 -> 3
        level >= 8 -> 2
        else -> 1
    }

    fun getTimeLimitMs(level: Int): Int = max(1500, 6000 - level * 55)

    fun clampLevel(level: Int): Int = level.coerceIn(0, 100)

    fun failPenalty(level: Int): Int = when {
        level >= 70 -> 5
        level >= 40 -> 3
        level >= 15 -> 2
        else -> 1
    }

    fun successDelta(level: Int): Int = if (level >= 80) 2 else 1

    fun miningReward(elapsedMs: Int, level: Int): Double {
        val timeLimit = getTimeLimitMs(level)
        val rewardMult = 1.0 + floor(level / 10.0) * 0.5
        val base = timeLimit * 0.5
        val raw = if (elapsedMs <= base) {
            PRICE * (base - elapsedMs) / base
        } else {
            -PRICE * 0.05 * min((elapsedMs - base) / base, 1.0)
        }
        return raw * rewardMult
    }

    fun generate(level: Int, lang: String = "en"): TrainingProblem {
        val diff = getDiff(level)
        val roll = Random.nextFloat()
        return when {
            roll < 0.55f -> genArith(diff, level, lang)
            roll < 0.75f -> genPercentage(diff, level, lang)
            else -> genSequence(diff, level, lang)
        }
    }

    private fun genArith(diff: Int, level: Int, lang: String): TrainingProblem {
        val maxN = 8 + diff * 12 + level / 2
        val a = Random.nextInt(2, maxN)
        val b = Random.nextInt(2, maxN)
        val ops = listOf("+", "-", "×")
        val op = ops.random()
        val ans = when (op) {
            "+" -> a + b
            "-" -> a - b
            else -> a * b
        }
        val q = if (lang == "es") "¿Cuánto es $a $op $b?" else "What is $a $op $b?"
        return mk(q, ans.toString(), diff, "arithmetic")
    }

    private fun genPercentage(diff: Int, level: Int, lang: String): TrainingProblem {
        val pct = listOf(10, 20, 25, 50, 5, 15).random()
        val base = (Random.nextInt(2, 6 + diff) * 20)
        val ans = base * pct / 100
        val q = if (lang == "es") "¿Cuánto es el $pct% de $base?" else "What is $pct% of $base?"
        return mk(q, ans.toString(), diff, "percentage")
    }

    private fun genSequence(diff: Int, level: Int, lang: String): TrainingProblem {
        val start = Random.nextInt(1, 12 + diff)
        val step = Random.nextInt(1, 4 + diff / 2)
        val terms = (0 until 4).map { start + it * step }
        val ans = start + 4 * step
        val shown = terms.joinToString(", ")
        val q = if (lang == "es") "Secuencia: $shown, ?" else "Sequence: $shown, ?"
        return mk(q, ans.toString(), diff, "sequence")
    }

    private fun mk(q: String, answer: String, diff: Int, type: String): TrainingProblem {
        val correct = answer.toIntOrNull()
        val choices = LinkedHashSet<String>()
        choices.add(answer)
        if (correct != null) {
            while (choices.size < 4) {
                val delta = Random.nextInt(1, 9 + diff * 2)
                val sign = if (Random.nextBoolean()) 1 else -1
                choices.add((correct + sign * delta).toString())
            }
        } else {
            while (choices.size < 4) choices.add((Random.nextInt(-20, 40)).toString())
        }
        return TrainingProblem(
            question = q,
            answer = answer,
            choices = choices.toList().shuffled(),
            difficulty = diff,
            problemType = type,
        )
    }
}
