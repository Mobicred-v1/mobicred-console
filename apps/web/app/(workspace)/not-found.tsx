import Link from 'next/link';
export default function NotFound() { return <section className="panel empty-state"><h1>Record not found</h1><p>The record does not exist or is outside your operational scope.</p><Link className="button" href="/overview">Return to operations</Link></section>; }
