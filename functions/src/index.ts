import * as functions from "firebase-functions";
import * as firebase from 'firebase-admin';

firebase.initializeApp();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  firebase.firestore().collection('line').add({token: `example-token-${Date.now().toString()}`})
  response.send("Hello from Firebase!");
});
