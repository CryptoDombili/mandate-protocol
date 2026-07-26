import type { Plan } from '../data'
import { TEST_TOKEN_LABEL } from '../token'

export function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: (plan: Plan) => void }) {
  return (
    <article className={`plan-card accent-${plan.accent}`}>
      <div className="plan-card-top">
        <span className="plan-monogram">{plan.monogram}</span>
        <span className="live-pill"><i /> LIVE</span>
      </div>
      <span className="plan-kicker">{plan.badge}</span>
      <h3>{plan.name}</h3>
      <p className="merchant">by {plan.merchant}</p>
      <p className="plan-copy">{plan.description}</p>
      <ul>
        {plan.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <div className="price-row">
        <div>
          <strong>{plan.price} {TEST_TOKEN_LABEL}</strong>
          <span>every {plan.period}</span>
        </div>
        <button className="small-button" onClick={() => onSelect(plan)}>
          Review terms
        </button>
      </div>
    </article>
  )
}
