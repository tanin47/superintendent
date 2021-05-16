import React from 'react';
import './app.scss';
import {firstEndpoint} from '../api';

export default function App(): JSX.Element {
  const [resp, setResp] = React.useState('not received');

  return (
    <div className="app">
      <h1>I'm React running in Electron App!!</h1>
      <button
        onClick={() => {
          firstEndpoint({question: "What is life?"})
            .then((resp) => {
              setResp(resp.answer);
              console.log(resp.answer);
            })
        }}
      >Click me</button>
      <h3>{resp}</h3>
    </div>
  );
}
