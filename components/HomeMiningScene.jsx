import MiningBotAvatar from '@/components/MiningBotAvatar';
import HomeChainScene3D from '@/components/HomeChainScene3D';

export default function HomeMiningScene() {
  return (
    <div className="mm3-home-arena" aria-hidden="true">
      <div className="mm3-home-arena-floor">
        <span className="mm3-home-arena-lane is-x" />
        <span className="mm3-home-arena-lane is-y" />
      </div>

      <div className="mm3-home-chain3d">
        <HomeChainScene3D size={220} />
      </div>

      <span className="mm3-home-arena-bot" style={{ '--bot-color': '#4ade80' }}>
        <MiningBotAvatar />
        <span className="ai-team-forge-shadow" />
      </span>
    </div>
  );
}
