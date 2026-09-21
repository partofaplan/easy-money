import { useNavigate } from 'react-router-dom';
import { OptionCard } from '../../components/OptionCard';
import { SetupFrame } from '../../components/SetupFrame';
import { starterBucketNames, useStore } from '../../state/store';

export function Buckets() {
  const { data, answer, setBuckets } = useStore();
  const navigate = useNavigate();
  const choice = data.answers.bucketChoice;

  const next = () => {
    if (choice === 'custom') {
      navigate('/setup/buckets/customize');
    } else {
      // Amounts are worked out from the paycheck on the summary screen.
      setBuckets([]);
      navigate('/setup/ready');
    }
  };

  return (
    <SetupFrame
      step={4}
      backTo="/setup/ahead"
      eyebrow="Question 4"
      title="Want to pick your own spending buckets, or should I choose for you?"
      lead="Buckets are where each dollar of a paycheck goes. Most first-timers do best with a small set."
      why="Too many categories is the most common reason a first budget gets abandoned. Seven is enough to see where money goes without turning every coffee into a decision."
      actions={
        <button type="button" className="btn btn-primary" disabled={choice === null} onClick={next}>
          Continue
        </button>
      }
    >
      <OptionCard
        selected={choice === 'auto'}
        onSelect={() => answer({ bucketChoice: 'auto' })}
        title="Choose for me"
        badge="Recommended"
        sub="A simple starter set. Rename, add or remove buckets anytime."
      />
      <OptionCard
        selected={choice === 'custom'}
        onSelect={() => answer({ bucketChoice: 'custom' })}
        title="Let me customize"
        sub="Start from the starter set or from scratch."
      />
      <div className="card stack" style={{ marginTop: 10, gap: 12 }}>
        <span className="eyebrow">Your starter buckets</span>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {starterBucketNames.map((n) => (
            <span key={n} className="chip">
              {n}
            </span>
          ))}
        </div>
        <span className="small muted">Seven buckets. We&rsquo;ll suggest an amount for each based on your paycheck.</span>
      </div>
    </SetupFrame>
  );
}
