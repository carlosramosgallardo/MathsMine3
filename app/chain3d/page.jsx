import MiningChain3D from '@/components/MiningChain3D'

export const metadata = {
  title: 'MM3 BLOCK CHAIN 3D',
  description: 'Explore the 28×28 MM3 block chain in real-time 3D FPV. Each block is a room. Your wallet is an avatar. See other miners live.',
}

export default function Chain3DPage() {
  return <MiningChain3D />
}
