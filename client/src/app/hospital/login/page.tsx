import { redirect } from 'next/navigation';
export default function HospitalLoginPage() {
    redirect('/auth/login?portal=hospital');
}
