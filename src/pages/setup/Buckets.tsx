import { useNavigate } from 'react-router-dom';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import { LIFESTYLE_QUESTIONS } from '../../data/lifestyle';
import { useStore } from '../../state/store';

/** A taste of what the guided questions ask, shown before the user commits to them. */
const SAMPLE_QUESTIONS = ['Do you drive?', 'Do you buy the groceries?', 'Any pets or kids at home?', 'Paying down debt?'];

export function Buckets() {
  const { data, answer } = useStore();
  const navigate = useNavigate();
  const choice = data.answers.bucketChoice;

  return (
    <SetupFrame
      step={4}
      backTo="/setup/ahead"
      eyebrow="Question 4"
      title="Want to pick your own spending buckets, or should I choose for you?"
      lead="Buckets are where each dollar of a paycheck goes. Most first-timers do best with a small set."
      why="Too many categories is the most common reason a first budget gets abandoned. Naming only what you actually spend on keeps the list short enough to remember."
      actions={
        <button
          type="button"
          className="btn btn-primary"
          disabled={choice === null}
          onClick={() => navigate(choice === 'custom' ? '/setup/buckets/customize' : '/setup/buckets/lifestyle')}
        >
          Continue
        </button>
      }
    >
      <OptionCard
        selected={choice === 'auto'}
        onSelect={() => answer({ bucketChoice: 'auto' })}
        title="Choose for me"
        badge="Recommended"
        sub={`${LIFESTYLE_QUESTIONS.length} quick questions about how you live, then I build the buckets to match.`}
      />
      <OptionCard
        selected={choice === 'custom'}
        onSelect={() => answer({ bucketChoice: 'custom' })}
        title="Let me customize"
        sub="Start from the starter set or from scratch."
      />
      <div className="card stack" style={{ marginTop: 10, gap: 12 }}>
        <span className="eyebrow">What I&rsquo;ll ask</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {SAMPLE_QUESTIONS.map((q) => (
            <span key={q} className="chip">
              {q}
            </span>
          ))}
        </div>
        <span className="small muted">
          Driving gets you a Gas bucket, groceries get their own, and anything you say no to never shows up. You can rename or drop any of them at the end.
        </span>
      </div>
    </SetupFrame>
  );
}
