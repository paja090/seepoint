import { AppShell } from '@/components/AppShell';
import { MapView } from '@/components/MapView';
import { carriers } from '@/lib/mock-data';
export default function MapPage(){ return <AppShell><MapView initialCarriers={carriers}/></AppShell> }
