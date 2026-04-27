'use client'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import NavLinks from '@/components/NavLinks'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import CurrencySwitcher from '@/components/CurrencySwitcher'
import AuthBar from '@/components/AuthBar'
import GlobalPulseBar from '@/components/GlobalPulseBar'
import MacroTicker from '@/components/MacroTicker'
import UtcClock from '@/components/UtcClock'
import { useSound } from '@/lib/sound-context'
function SoundToggle(){const {enabled,toggleSound}=useSound();return <button onClick={toggleSound} className='flex items-center justify-center rounded-sm border border-cyan-500/20 px-1.5 py-1 text-slate-400'>{enabled?'🔊':'🔇'}</button>}
export default function Header(){const pathname=usePathname();return <header className={`fixed top-0 left-0 right-0 z-50 bg-black/97 ${pathname==='/trade-mm3'?'mm3-trade-header':''}`}><div className='mm3-header-ticker flex h-7 sm:h-[34px] items-center overflow-hidden border-b border-green-400/20 bg-black/60'><MacroTicker/></div><div className='border-b border-cyan-900/15 overflow-x-auto no-scrollbar max-sm:portrait:overflow-visible'><div className='flex h-12 items-center justify-center gap-1.5 px-3 sm:h-14 sm:gap-2.5 sm:px-4 max-sm:portrait:h-auto max-sm:portrait:min-h-12 max-sm:portrait:flex-wrap max-sm:portrait:gap-x-2 max-sm:portrait:gap-y-1 max-sm:portrait:py-1.5'><GlobalPulseBar/><Link href='/'><Image src='/og-image.jpg' alt='MM3' width={38} height={38} priority/></Link><div aria-hidden='true' className='hidden basis-full max-sm:portrait:block max-sm:portrait:h-0'/><div className='contents max-sm:portrait:flex max-sm:portrait:w-full max-sm:portrait:items-center max-sm:portrait:justify-center max-sm:portrait:gap-2'><CurrencySwitcher/><LanguageSwitcher/><SoundToggle/><AuthBar mode='controls'/></div></div></div><div className='mm3-header-wallet-row flex h-7 items-center justify-center gap-1.5 sm:gap-2 border-b border-cyan-900/10 px-2 sm:px-4 overflow-x-auto no-scrollbar'><UtcClock className='font-mono text-[0.65rem] sm:text-[0.80rem] text-cyan-300 shrink-0'/><Link href='/manifesto'>📜</Link><Link href='/ai-team'>🤖</Link><AuthBar mode='wallet'/></div><nav className='mm3-header-nav h-11 sm:h-[52px] overflow-x-auto no-scrollbar px-3 sm:px-0'><div className='mm3-header-nav-inner mx-auto max-w-5xl h-full'><NavLinks className='h-full justify-start sm:justify-center'/></div></nav></header>}