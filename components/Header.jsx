'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import NavLinks from '@/components/NavLinks'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import CurrencySwitcher from '@/components/CurrencySwitcher'
import AuthBar from '@/components/AuthBar'
import GlobalPulseBar from '@/components/GlobalPulseBar'
import MacroTicker from '@/components/MacroTicker'
import UtcClock from '@/components/UtcClock'
import { useSound } from '@/lib/sound-context'
import supabase from '@/lib/supabaseClient'

function SoundToggle() { return null }

export default function Header(){return null}
