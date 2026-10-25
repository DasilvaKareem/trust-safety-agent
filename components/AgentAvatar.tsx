import { createElement } from 'react';
import Script from 'next/script';

type AvatarState = 'idle' | 'thinking' | 'happy' | 'suspicious' | 'confused';

export default function AgentAvatar({ state = 'idle', message = 'Ready to inspect your next deployment.', variant = 'panel' }: {
  state?: AvatarState;
  message?: string;
  variant?: 'panel' | 'conversation';
}) {
  return (
    <section className={`agent-avatar-panel${variant === 'conversation' ? ' agent-avatar-conversation' : ''}`} aria-label="Argon Guard agent">
      <Script src="/morph-bot/morph-bot.js" type="module" strategy="afterInteractive" />
      <div className="agent-avatar-stage" aria-hidden="true">
        {createElement('morph-bot', {
          state, shape: 'blob', size: '160', material: 'rainbow-glass',
          'glass-preset': 'argon-neon', 'eye-color': '#f1f5ff', 'follow-pointer': '',
          label: 'Argon Guard assistant',
        })}
      </div>
      <div className="agent-avatar-copy">
        <span className="agent-avatar-eyebrow">Argon Guard</span>
        {variant === 'panel' && <h2>Your watchful companion.</h2>}
        <p role="status" aria-live="polite">{message}</p>
        {variant === 'panel' && <span className="agent-avatar-tag">Flash screening · Argon deep analysis</span>}
      </div>
    </section>
  );
}
