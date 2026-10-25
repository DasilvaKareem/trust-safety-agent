import type { GetServerSideProps } from 'next';
export default function IntegrationSuccess() { return null; }
export const getServerSideProps: GetServerSideProps = async () => ({ redirect: { destination: '/onboarding?step=connect', permanent: false } });
