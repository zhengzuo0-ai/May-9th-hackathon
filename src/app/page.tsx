import Workstation from "@/components/Workstation";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const demo = stringParam(params.demo);
  const intake = stringParam(params.intake);

  return <Workstation initialDemoId={demo} initialIntakeText={intake} />;
}

function stringParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
