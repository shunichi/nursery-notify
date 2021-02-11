import { postApi } from "./Api";

type ActivationApiResponse = {
  message: string;
};

export const sendActivationCode = async (code: string): Promise<boolean> => {
  try {
    const response = await postApi<ActivationApiResponse>('/api/activate', { code });
    if (response) {
      console.log('/api/activate succeeded', response.data);
    }
    return true;
  } catch (error) {
    console.log('/api/activate faild', error?.response.data);
    return false;
  }
}


