import { Composition } from "remotion";
import { VerticalClip } from "./VerticalClip";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VerticalClip"
      component={VerticalClip}
      durationInFrames={30 * 60} // 60 seconds at 30fps
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        videoSrc: "",
        captions: [],
      }}
    />
  );
};
