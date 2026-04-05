import { Composition } from "remotion";
import { VerticalClip } from "./VerticalClip";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VerticalClip"
      component={VerticalClip}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{
        videoSrc: "",
        captions: [],
        durationMs: 60000,
      }}
      calculateMetadata={async ({ props }) => {
        const frames = Math.ceil((props.durationMs / 1000) * FPS);
        return { durationInFrames: frames };
      }}
    />
  );
};
