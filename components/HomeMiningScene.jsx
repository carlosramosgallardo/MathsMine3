import HomeChainScene3D from '@/components/HomeChainScene3D';
import HomeBotScene3D from '@/components/HomeBotScene3D';

export default function HomeMiningScene() {
  return (
    <div className="mm3-home-arena" aria-hidden="true">
      <div className="mm3-home-arena-floor">
        <span className="mm3-home-arena-lane is-x" />
        <span className="mm3-home-arena-lane is-y" />
      </div>

      <div className="mm3-home-chain3d">
        <HomeChainScene3D width={110} height={230} />
      </div>

      <div className="mm3-home-bot3d">
        <HomeBotScene3D size={110} />
      </div>
    </div>
  );
}
