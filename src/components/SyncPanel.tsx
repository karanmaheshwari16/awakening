import { useEffect, useState } from 'preact/hooks';
import { connect, disconnect, syncNow, syncStatus } from '../state/sync';
import { Icon } from './Icon';
import { Btn, Sys, toast } from './ui';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Awakening%20sync';

function ago(t?: number): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString();
}

export function SyncPanel() {
  const st = syncStatus.use();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  // Keep "synced 2 min ago" fresh while the screen is open.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const onConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await connect(token);
      setToken('');
      toast(r.pulled > 0 ? `Sync is on. Brought in ${r.pulled} session${r.pulled === 1 ? '' : 's'} from your other device.` : 'Sync is on.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (st.state === 'off') {
    return (
      <Sys label="Auto sync">
        <p>
          Keep your iPhone and laptop in step automatically. Your progress is saved to a private, hidden note (a “secret
          gist”) in <b>your own GitHub account</b>. It's free, and nobody else can see it.
        </p>
        <p style={{ marginBottom: 6 }}>One-time setup on each device:</p>
        <ol class="sync-steps">
          <li>
            <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer">Open GitHub's key page</a> and sign in.
          </li>
          <li>
            Under <i>Expiration</i> choose <b>No expiration</b>. Leave only <b>gist</b> ticked. Scroll down and tap{' '}
            <b>Generate token</b>.
          </li>
          <li>
            Copy the key (it starts with <span class="mono">ghp_</span>) and paste it below. GitHub shows it only once, so
            keep it in Notes or Passwords for your other device.
          </li>
        </ol>
        <label class="label" for="gh-token" style={{ display: 'block', margin: '12px 0 6px' }}>
          GitHub key
        </label>
        <input
          id="gh-token"
          class="field field-line"
          type="password"
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          placeholder="ghp_…"
          value={token}
          onInput={(e) => setToken((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && token.trim() && !busy && onConnect()}
        />
        {error && (
          <p class="field-note" style={{ color: 'var(--bad)' }}>
            <Icon name="caution" size={14} /> {error}
          </p>
        )}
        <div class="btn-row" style={{ marginTop: 12 }}>
          <Btn icon="sync" disabled={!token.trim() || busy} onClick={onConnect}>
            {busy ? 'Connecting…' : 'Turn on sync'}
          </Btn>
        </div>
        <p class="field-note" style={{ marginTop: 12 }}>
          The key stays on this device only and can do nothing except read and write your gists. You can delete it any
          time on GitHub.
        </p>
      </Sys>
    );
  }

  const dot = st.state === 'error' ? 'err' : st.state === 'syncing' ? 'on busy' : st.state === 'idle' ? 'on' : '';
  const line =
    st.state === 'syncing'
      ? 'Syncing…'
      : st.state === 'offline'
        ? `Offline. Will sync when you're back online · last ${ago(st.lastSync)}`
        : st.state === 'error'
          ? `Not synced · last ${ago(st.lastSync)}`
          : `Synced ${ago(st.lastSync)}`;

  return (
    <Sys label="Auto sync">
      <div class="sync-status" role="status">
        <span class={`dot ${dot}`} aria-hidden="true" />
        <span>
          {line}
          {st.login && <span class="muted"> · @{st.login}</span>}
        </span>
      </div>
      {st.state === 'error' && (
        <p class="field-note" style={{ color: 'var(--bad)', marginTop: 0 }}>
          <Icon name="caution" size={14} /> {st.message}
        </p>
      )}
      <p class="field-note" style={{ marginTop: 0 }}>
        Syncs when you open the app, when you come back to it, and a few seconds after each session. Turn it on with the
        same GitHub account on every device you use.
      </p>
      <div class="btn-row" style={{ marginTop: 12 }}>
        <Btn variant="ghost" icon="sync" disabled={st.state === 'syncing'} onClick={() => void syncNow()}>
          Sync now
        </Btn>
        <Btn
          variant="quiet"
          onClick={() => {
            disconnect();
            toast('Sync turned off on this device. Your progress here is kept.');
          }}
        >
          Turn off
        </Btn>
      </div>
      {st.state === 'error' && /key/i.test(st.message) && (
        <p class="field-note">To use a new key, tap Turn off, then paste the new key.</p>
      )}
    </Sys>
  );
}
