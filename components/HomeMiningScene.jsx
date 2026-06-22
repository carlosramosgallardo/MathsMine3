import MiningBotAvatar from '@/components/MiningBotAvatar';

export default function HomeMiningScene() {
  return (
    <div className="mm3-home-arena" aria-hidden="true">
      <div className="mm3-home-arena-floor">
        <span className="mm3-home-arena-lane is-x" />
        <span className="mm3-home-arena-lane is-y" />
      </div>

      <div className="mm3-home-arena-stands">
        <span className="is-tier-1" />
        <span className="is-tier-2" />
        <span className="is-tier-3" />
      </div>

      <div className="mm3-home-arena-sword">
        <span className="mm3-home-sword-pommel" />
        <span className="mm3-home-sword-grip" />
        <span className="mm3-home-sword-guard" />
        <span className="mm3-home-sword-blade" />
        <span className="mm3-home-sword-tip" />
      </div>

      <span className="mm3-home-arena-bot" style={{ '--bot-color': '#4ade80' }}>
        <MiningBotAvatar />
        <span className="ai-team-forge-shadow" />
      </span>
    </div>
  );
}
