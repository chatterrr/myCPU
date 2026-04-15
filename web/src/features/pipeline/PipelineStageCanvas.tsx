import { Container, Graphics, Stage, Text } from "@pixi/react";
import { Graphics as PixiGraphics, TextStyle } from "pixi.js";
import { getStagePalette, pipelineStageOrder } from "@/features/pipeline/palette";
import type {
  TracePipelineSnapshot,
  TracePipelineStage,
  TraceStepRecord
} from "@/features/trace/types";

const stageLabelStyle = new TextStyle({
  fill: 0xf8fafc,
  fontFamily: "Space Grotesk",
  fontSize: 21,
  fontWeight: "700"
});

const stageBodyStyle = new TextStyle({
  fill: 0xdbeafe,
  fontFamily: "Space Grotesk",
  fontSize: 14,
  lineHeight: 22,
  wordWrap: true,
  wordWrapWidth: 144
});

const captionStyle = new TextStyle({
  fill: 0x93c5fd,
  fontFamily: "Space Grotesk",
  fontSize: 14,
  fontWeight: "600"
});

const canvasWidth = 1080;
const canvasHeight = 300;
const stageWidth = 176;
const stageHeight = 174;
const stageGap = 28;
const stageStartX = 36;
const stageY = 72;
const emptyStage: TracePipelineStage = { state: "empty" };

function drawBackdrop(graphics: PixiGraphics) {
  graphics.clear();
  graphics.lineStyle(4, 0x164e63, 0.9);

  for (let index = 0; index < pipelineStageOrder.length - 1; index += 1) {
    const startX = stageStartX + index * (stageWidth + stageGap) + stageWidth;
    const endX = startX + stageGap - 8;
    const midY = stageY + stageHeight / 2;

    graphics.moveTo(startX + 8, midY);
    graphics.lineTo(endX, midY);
    graphics.lineTo(endX - 12, midY - 8);
    graphics.moveTo(endX, midY);
    graphics.lineTo(endX - 12, midY + 8);
  }
}

function drawStageBox(
  graphics: PixiGraphics,
  x: number,
  y: number,
  state: string
) {
  const palette = getStagePalette(state);
  graphics.clear();
  graphics.lineStyle(3, palette.stroke, 1);
  graphics.beginFill(palette.fill, 0.94);
  graphics.drawRoundedRect(x, y, stageWidth, stageHeight, 26);
  graphics.endFill();
}

function renderStageBody(stage: TracePipelineStage) {
  return [
    `STATE ${stage.state.toUpperCase()}`,
    `PC    ${stage.pc ?? "-"}`,
    `OP    ${stage.op ?? "-"}`,
    `RAW   ${stage.raw ?? "-"}`
  ].join("\n");
}

function renderEventSummary(pipeline: TracePipelineSnapshot) {
  const details: string[] = [];

  if (pipeline.stall) {
    details.push(
      `STALL ${pipeline.stall_reason ? pipeline.stall_reason.toUpperCase() : "YES"}`
    );
  }

  if (pipeline.bubble.length) {
    details.push(`BUBBLE ${pipeline.bubble.join(", ")}`);
  }

  if (pipeline.flush.length) {
    details.push(`FLUSH ${pipeline.flush.join(", ")}`);
  }

  return details.length ? details.join("  |  ") : "STEADY FLOW";
}

export function PipelineStageCanvas({ step }: { step: TraceStepRecord }) {
  if (!step.pipeline) {
    return (
      <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
        This step does not include pipeline payload.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1080px] rounded-[28px] border border-white/10 bg-slate-950/70 p-4">
        <Stage
          width={canvasWidth}
          height={canvasHeight}
          options={{ antialias: true, backgroundAlpha: 0 }}
        >
          <Graphics draw={drawBackdrop} />
          <Text
            text={`Cycle ${step.pipeline.cycle}`}
            x={36}
            y={18}
            style={captionStyle}
          />
          <Text
            text={renderEventSummary(step.pipeline)}
            x={184}
            y={18}
            style={captionStyle}
          />
          {pipelineStageOrder.map((stageRef, index) => {
            const stage = step.pipeline?.[stageRef.key] ?? emptyStage;
            const x = stageStartX + index * (stageWidth + stageGap);

            return (
              <Container key={stageRef.key}>
                <Graphics
                  draw={(graphics) => drawStageBox(graphics, x, stageY, stage.state)}
                />
                <Text
                  text={stageRef.label}
                  x={x + 18}
                  y={stageY + 16}
                  style={stageLabelStyle}
                />
                <Text
                  text={renderStageBody(stage)}
                  x={x + 18}
                  y={stageY + 54}
                  style={stageBodyStyle}
                />
              </Container>
            );
          })}
        </Stage>
      </div>
    </div>
  );
}
