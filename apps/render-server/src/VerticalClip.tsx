import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Video,
  Sequence,
} from "remotion";

interface Caption {
  text: string;
  startMs: number;
  endMs: number;
}

interface VerticalClipProps {
  videoSrc: string;
  captions: Caption[];
  durationMs: number;
}

const CaptionOverlay: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 200,
        left: 40,
        right: 40,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: "Arial Black, Arial, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          color: "#FFFFFF",
          textTransform: "uppercase",
          textShadow: "4px 4px 0px #000000, -2px -2px 0px #000000",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
        }}
      >
        {text}
      </span>
    </div>
  );
};

export const VerticalClip: React.FC<VerticalClipProps> = ({
  videoSrc,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const activeCaption = captions.find(
    (c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {videoSrc && (
        <Video
          src={videoSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {activeCaption && <CaptionOverlay text={activeCaption.text} />}
      {!videoSrc && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: "#666",
              fontSize: 32,
              fontFamily: "system-ui",
            }}
          >
            9:16 Vertical Clip Preview
          </span>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
