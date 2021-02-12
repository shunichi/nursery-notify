import { postApi } from "./Api";

type NotifyApiResponse = {
  status: number;
  message: string;
};

export async function sendLineMessage(message: string): Promise<boolean> {
  try {
    const response = await postApi<NotifyApiResponse>('/api/line/notify', { message });
    if (response) {
      console.log(response.data);
      return true;
    } else {
      console.log('/api/line/notify no response');
      return false;
    }
  } catch {
    console.log('/api/line/notify caught exception');
    return false;
  }
}
