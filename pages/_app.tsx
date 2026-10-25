import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <><Head><title>Argon Guard</title><link rel="icon" href="/favicon.ico" sizes="any" /><link rel="icon" type="image/png" href="/favicon.png" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /></Head><Component {...pageProps} /></>;
}
