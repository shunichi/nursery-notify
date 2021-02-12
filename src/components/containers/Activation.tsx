import React, { FunctionComponent } from 'react';
import { ActivationForm } from "../ActivationForm"
import { parseQueryString } from "../../lib/QueryString";

export const Activation: FunctionComponent = () => {
  const params = parseQueryString(window.location.search);
  const code = params.invitation || "";
  return <ActivationForm code={code} />;
};
