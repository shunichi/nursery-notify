import React, { FunctionComponent } from 'react';
import "../styles/app.scss";

type Props = {
  content: string;
};

export const App: FunctionComponent<Props> = (props: Props) => {
  return (<div className="app">{props.content}</div>);
};
