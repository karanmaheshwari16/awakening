import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { Icon } from './components/Icon';
import { Btn, Sys, Toasts, toast } from './components/ui';
import { RewardOverlay, hideReward } from './components/Reward';
import { useRoute, href } from './lib/router';
import { dueShadows } from './state/derive';
import { ensureDailyQuest } from './state/quests';
import { getSaveError, markIntroSeen, requestPersistence, useGame } from './state/store';
import { Home } from './screens/Home';
import { RegionScreen } from './screens/Region';
import { LessonScreen } from './screens/Lesson';
import { CheckScreen } from './screens/Check';
import { Shadows, ReviewScreen } from './screens/Shadows';
import { Gates, GateScreen } from './screens/Gates';
import { Hunter } from './screens/Hunter';
import { Settings } from './screens/Settings';
import { PenaltyScreen } from './screens/Penalty';

let updateSW: ((reload?: boolean) => Promise<void>) | null = null;

export function App() {
  const route = useRoute();
  const { saved, d } = useGame();
  const [needRefresh, setNeedRefresh] = useState(false);

  // Apply device settings to the page.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = saved.settings.textSize;
    root.dataset.motion = saved.settings.motion === 'reduce' ? 'reduce' : 'system';
  }, [saved.settings]);

  useEffect(() => {
    ensureDailyQuest();
  }, [d.today, d.sessions]);

  useEffect(() => {
    updateSW = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => toast('Ready to work offline.'),
    });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    hideReward();
  }, [route.key]);

  const reading = route.name === 'lesson' || route.name === 'check' || route.name === 'review' || route.name === 'penalty';
  const tab =
    route.name === 'home' || route.name === 'region' ? 'map'
    : route.name === 'shadows' || route.name === 'review' ? 'shadows'
    : route.name === 'gates' || route.name === 'gate' ? 'gates'
    : route.name === 'hunter' || route.name === 'settings' ? 'hunter'
    : '';

  let screen;
  switch (route.name) {
    case 'region': screen = <RegionScreen id={route.params[0]} />; break;
    case 'lesson': screen = <LessonScreen id={route.params[0]} />; break;
    case 'check': screen = <CheckScreen id={route.params[0]} />; break;
    case 'shadows': screen = <Shadows />; break;
    case 'review': screen = <ReviewScreen region={route.params[0]} topic={route.params[1]} />; break;
    case 'gates': screen = <Gates />; break;
    case 'gate': screen = <GateScreen id={route.params[0]} />; break;
    case 'hunter': screen = <Hunter />; break;
    case 'settings': screen = <Settings />; break;
    case 'penalty': screen = <PenaltyScreen />; break;
    default: screen = <Home />;
  }

  const paper = reading && saved.settings.paper;
  const dueCount = dueShadows(d).length;
  const saveError = getSaveError();

  return (
    <div class={`app ${paper ? 'paper' : ''} ${reading ? 'reader' : ''}`}>
      {!reading && (
        <nav class="nav" aria-label="Main">
          <div class="nav-brand">
            <b>AWAKENING</b>
          </div>
          <a class="tab" href={href.home()} aria-current={tab === 'map' ? 'page' : undefined}>
            <Icon name="map" size={22} />
            <span>Map</span>
          </a>
          <a class="tab" href={href.shadows()} aria-current={tab === 'shadows' ? 'page' : undefined}>
            <Icon name="shadows" size={22} />
            <span>Shadows</span>
            {dueCount > 0 && <i class="tab-dot" aria-label={`${dueCount} due`} />}
          </a>
          <a class="tab" href={href.gates()} aria-current={tab === 'gates' ? 'page' : undefined}>
            <Icon name="gates" size={22} />
            <span>Gates</span>
          </a>
          <a class="tab" href={href.hunter()} aria-current={tab === 'hunter' ? 'page' : undefined}>
            <Icon name="hunter" size={22} />
            <span>Hunter</span>
          </a>
          <div class="nav-foot">Progress is saved on this device. Sync in Settings.</div>
        </nav>
      )}
      <main class={`main ${reading ? 'full' : ''}`} key={route.key}>
        {needRefresh && (
          <div class="banner" style={{ marginBottom: 12 }}>
            <Icon name="sparkle" />
            <span>A new version of the System is ready.</span>
            <Btn variant="ghost" onClick={() => updateSW?.(true)}>Update</Btn>
          </div>
        )}
        {saveError && (
          <div class="banner" style={{ marginBottom: 12 }}>
            <Icon name="caution" />
            <span>{saveError}</span>
          </div>
        )}
        {screen}
      </main>
      <RewardOverlay />
      <Toasts />
      {!saved.seen.intro && <Intro />}
    </div>
  );
}

function Intro() {
  return (
    <div class="scrim">
      <Sys label="System" tone="accent" class="intro reward">
        <p class="typed">
          You have been selected as a Player.
          <br />
          The System grants you one ability: to level up through knowledge.
        </p>
        <p>
          Each day brings a short quest of 10–15 minutes. Finish sessions to earn XP, raise your rank in each region of
          knowledge, and grow your Shadow Army of topics you've mastered.
        </p>
        <p>Your progress lives on this device. Back it up or sync it from Settings.</p>
        <Btn
          class="wide"
          glow
          onClick={() => {
            markIntroSeen();
            void requestPersistence();
          }}
        >
          Accept
        </Btn>
      </Sys>
    </div>
  );
}
