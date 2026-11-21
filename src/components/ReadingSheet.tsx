import { setSettings, useGame } from '../state/store';
import type { Settings } from '../state/types';
import { Segmented, Sheet, Toggle } from './ui';

export function ReadingControls() {
  const { saved } = useGame();
  const s = saved.settings;
  return (
    <>
      <div class="setting">
        <div class="label">Text size</div>
        <Segmented<Settings['textSize']>
          label="Text size"
          value={s.textSize}
          options={[
            { value: 'S', label: 'S' },
            { value: 'M', label: 'M' },
            { value: 'L', label: 'L' },
            { value: 'XL', label: 'XL' },
          ]}
          onChange={(v) => setSettings({ textSize: v })}
        />
      </div>
      <Toggle
        label="Paper theme for lessons"
        desc="A warm, light page for long reading."
        checked={s.paper}
        onChange={(v) => setSettings({ paper: v })}
      />
      <Toggle
        label="Reduce motion"
        desc="Turns off animations. Also follows your device's setting."
        checked={s.motion === 'reduce'}
        onChange={(v) => setSettings({ motion: v ? 'reduce' : 'system' })}
      />
    </>
  );
}

export function ReadingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Reading settings">
      <ReadingControls />
    </Sheet>
  );
}
