import type { StepInfo } from '../hooks/usePipelineSteps';
import styles from '../styles/console.module.css';

interface PipelineStepsProps {
  steps: StepInfo[];
}

export function PipelineSteps({ steps }: PipelineStepsProps) {
  return (
    <>
      <div className={styles.panelSection} style={{ paddingBottom: 6 }}>
        <div className={styles.panelSectionTitle}>
          <i className="fa-solid fa-route" /> 处理管道
        </div>
      </div>
      <div className={styles.steps}>
        {steps.map((step) => (
          <div key={step.id} className={`${styles.step} ${styles[step.state]}`}>
            <div className={styles.stepIcon}>
              <i className={`fa-solid ${step.icon}`} />
            </div>
            <div className={styles.stepInfo}>
              <div className={styles.stepName}>{step.name}</div>
              <div className={styles.stepDetail}>{step.detail}</div>
              {step.latency && <div className={styles.latency}>{step.latency}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
