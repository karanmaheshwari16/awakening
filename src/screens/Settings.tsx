import { useEffect, useRef, useState } from 'preact/hooks';
import { catalog } from '../content/catalog';
import { Icon } from '../components/Icon';
import { ReadingControls } from '../components/ReadingSheet';
import { Btn, Sheet, Sys, TopBar, toast } from '../components/ui';
import { devDayOffset, setDevDayOffset, today } from '../lib/date';
import { href } from '../lib/router';
import type { Derived } from '../state/derive';
import {
  applyMerged,
  backupBlob,
  parseBackup,
  previewMerge,
  refresh,
  requestPersistence,
  resetAll,
  useGame,
} from '../state/store';
import type { Saved } from '../state/types';

function summary(d: Derived) {
  return `${d.rank.rank}-Rank · ${d.xp.toLocaleString()} XP · ${d.lessonsDone} lessons · ${d.shadows.size} shadows`;
}

async function exportBackup() {
  const { blob, filename } = backupBlob();
  const file = new File([blob], filename, { type: 'application/json' });
  const touch = matchMedia('(pointer: coarse)').matches;
  // On iPhone the share sheet lets you AirDrop it or "Save to Files".
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Awakening backup' });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Saved ${filename}`);
}

export function Settings() {
  const { saved, d } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ merged: Saved; before: Derived; after: Derived; added: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const onFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const incoming = parseBackup(await f.text());
      setError(null);
      setPending(previewMerge(incoming));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <TopBar sub="Hunter" title="Settings" fallback={href.hunter()} />
      <div class="settings">
        <Sys label="Reading">
          <ReadingControls />
          <div class="preview-text">The universe is under no obligation to make sense to you, but it rewards those who look closely.</div>
        </Sys>

        <Sys label="Sync & backup">
          <p>
            Your progress is stored on <b>this device</b> only. Use these buttons to back it up, or to keep your iPhone and
            laptop in step. Merging combines both histories, so nothing is lost or counted twice.
          </p>
          <ol>
            <li>On one device, tap <b>Export</b>. On iPhone, AirDrop it to your Mac or save it to iCloud Drive.</li>
            <li>On the other device, tap <b>Import &amp; merge</b> and pick that file.</li>
            <li>To sync both ways, then do the same in reverse.</li>
          </ol>
          <div class="btn-row">
            <Btn variant="ghost" icon="upload" onClick={exportBackup}>Export</Btn>
            <Btn variant="ghost" icon="download" onClick={() => fileRef.current?.click()}>Import &amp; merge</Btn>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" class="sr-only" onChange={onFile} tabIndex={-1} />
          {error && (
            <p class="field-note" style={{ color: 'var(--bad)', marginTop: 10 }}>
              <Icon name="caution" size={14} /> {error}
            </p>
          )}
          <p class="field-note" style={{ marginTop: 12 }}>
            iPhone tip: Safari can clear website data that hasn't been used for a while. Export a backup now and then.
            {persisted === true && ' This browser has granted protected storage.'}
            {persisted === false && (
              <>
                {' '}
                <button class="btn-quiet" style={{ textDecoration: 'underline', minHeight: 0, padding: 0 }} onClick={async () => setPersisted(await requestPersistence())}>
                  Request protected storage
                </button>
              </>
            )}
          </p>
        </Sys>

        <Sys label="Install">
          <p style={{ marginBottom: 6 }}>
            <b>iPhone:</b> open this site in Safari → Share → <i>Add to Home Screen</i>.
          </p>
          <p style={{ marginBottom: 6 }}>
            <b>Mac (Safari):</b> File → <i>Add to Dock</i>. <b>Chrome / Edge:</b> the install icon in the address bar.
          </p>
          <p style={{ margin: 0 }}>After the first load, everything works offline.</p>
        </Sys>

        <Sys label="About">
          <p style={{ margin: 0 }}>
            {catalog.lessons.length} lessons · {catalog.regions.length} regions · {catalog.gates.length} gates in this version.
            <br />
            You: {summary(d)} · {saved.events.length} sessions logged.
          </p>
        </Sys>

        {import.meta.env.DEV && (
          <Sys label="Developer · time travel">
            <p>Pretend today is a different day to test streaks and reviews. Today is {today()} (offset {devDayOffset()}).</p>
            <div class="btn-row">
              <Btn variant="ghost" onClick={() => { setDevDayOffset(devDayOffset() - 1); refresh(); }}>−1 day</Btn>
              <Btn variant="ghost" onClick={() => { setDevDayOffset(devDayOffset() + 1); refresh(); }}>+1 day</Btn>
              <Btn variant="ghost" onClick={() => { setDevDayOffset(0); refresh(); }}>Reset</Btn>
            </div>
          </Sys>
        )}

        <Sys label="Start over">
          <p>Erase all progress on this device. Your reading settings stay. Export a backup first if you might want it back.</p>
          <Btn variant="ghost" onClick={() => setConfirmReset(true)}>Erase progress…</Btn>
        </Sys>
      </div>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Merge backup">
        {pending && (
          <>
            <p class="quest-copy">
              {pending.added > 0
                ? `The backup adds ${pending.added} session${pending.added === 1 ? '' : 's'} this device doesn't have yet.`
                : 'Everything in this backup is already on this device.'}
            </p>
            <div class="setting">
              <div class="label">This device now</div>
              <div class="mono" style={{ fontSize: 13 }}>{summary(pending.before)}</div>
            </div>
            <div class="setting">
              <div class="label">After merging</div>
              <div class="mono accent" style={{ fontSize: 13 }}>{summary(pending.after)}</div>
            </div>
            <div class="btn-row">
              <Btn variant="quiet" onClick={() => setPending(null)}>Cancel</Btn>
              <Btn
                disabled={pending.added === 0}
                onClick={() => {
                  applyMerged(pending.merged);
                  setPending(null);
                  toast('Progress merged.');
                }}
              >
                Merge
              </Btn>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Erase progress">
        <p class="quest-copy">
          This permanently erases {saved.events.length} sessions, your notes and Gate answers on this device. It can't be
          undone unless you have a backup.
        </p>
        <div class="btn-row">
          <Btn variant="quiet" onClick={() => setConfirmReset(false)}>Keep my progress</Btn>
          <Btn
            variant="ghost"
            style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}
            onClick={() => {
              resetAll();
              setConfirmReset(false);
              toast('Progress erased. A new journey begins.');
            }}
          >
            Erase everything
          </Btn>
        </div>
      </Sheet>
    </>
  );
}
