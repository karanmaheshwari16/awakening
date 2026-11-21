import { render } from 'preact';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';

render(<App />, document.getElementById('app')!);
