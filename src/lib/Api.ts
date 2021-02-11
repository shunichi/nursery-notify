import axios, { AxiosResponse } from 'axios';
import firebase from "firebase";

export async function getApi<T>(path: string): Promise<AxiosResponse<T> | null> {
  const apiUrl = `${process.env.APP_BASE_URL}${path}`;
  const user = firebase.auth().currentUser;
  // console.log("user", user);
  if (user == null) return null;
  const idToken = await user.getIdToken();
  // console.log("idToken", idToken);
  if (idToken == null) return null;
  const headers = { 'Authorization': `Bearer ${idToken}` }
  try {
    return await axios.get<T>(apiUrl, { headers });
  } catch(error) {
    console.log(error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export async function postApi<T>(path: string, data: any): Promise<AxiosResponse<T> | null> {
  const apiUrl = `${process.env.APP_BASE_URL}${path}`;
  const user = firebase.auth().currentUser;
  if (user == null) return null;
  const idToken = await user.getIdToken();
  if (idToken == null) return null;
  const headers = { 'Authorization': `Bearer ${idToken}` }
  return await axios.post<T>(apiUrl, data, { headers });
}
