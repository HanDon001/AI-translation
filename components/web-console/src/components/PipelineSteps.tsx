import type { StepInfo } from '../hooks/usePipelineSteps';

interface PipelineStepsProps {
  steps: StepInfo[];
}

export function PipelineSteps({ steps }: PipelineStepsProps) {
  return (
    <>
      <div className="panel-section" style={{ paddingBottom: 6 }}>
        <div className="panel-section-title">
          <i className="fa-solid fa-route" /> 处理管道
        </div>
      </div>
      <div className="steps">
        {steps.map((step) => (
          <div key={step.id} className={`step ${step.state}`}>
            <div className="step-icon">
              <i className={`fa-solid ${step.icon}`} />
            </div>
            <div className="step-info">
              <div className="step-name">{step.name}</div>
              <div className="step-detail">{step.detail}</div>
              {step.latency && <div className="latency">{step.latency}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
