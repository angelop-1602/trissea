import { Ride } from '@/lib/mock-db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { MapPin, Clock, DollarSign, Navigation } from 'lucide-react';

interface RideCardProps {
  ride: Ride;
  onClick?: () => void;
  clickable?: boolean;
}

export function RideCard({ ride, onClick, clickable = false }: RideCardProps) {
  return (
    <Card
      className={clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{ride.pickupLocation}</CardTitle>
            <CardDescription className="text-xs">→ {ride.dropoffLocation}</CardDescription>
          </div>
          <StatusBadge status={ride.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col items-center p-2 rounded bg-muted/50">
            <Navigation className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs text-muted-foreground">{ride.distance}km</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded bg-muted/50">
            <Clock className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs text-muted-foreground">{ride.estimatedDuration}min</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded bg-muted/50">
            <DollarSign className="h-4 w-4 text-primary mb-1" />
            <span className="text-xs text-muted-foreground font-medium">₱{ride.fare}</span>
          </div>
        </div>

        {ride.driverId && (
          <div className="text-xs text-muted-foreground p-2 rounded bg-primary/5">
            <span className="font-medium">Driver assigned</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
