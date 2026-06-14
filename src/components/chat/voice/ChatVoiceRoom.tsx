import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Users,
  ChevronDown,
  ChevronUp,
  Volume2,
  Hand,
  Settings,
  PhoneOff,
} from 'lucide-react';
import { useVoiceRoom } from '@/contexts/VoiceRoomContext';
import { cn } from '@/lib/utils';
import { analyticsClient } from '@/utils/analytics';

interface VoiceParticipant {
  userId: string;
  name: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  handRaised: boolean;
  hasMicrophone?: boolean;
}

interface ChatVoiceRoomProps {
  groupId: string;
  groupName: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export const ChatVoiceRoom = ({
  groupId,
  groupName,
  expanded,
  onExpandedChange,
}: ChatVoiceRoomProps) => {
  const {
    isConnected,
    participants,
    participantCount,
    isMuted,
    isDeafened,
    handRaised,
    leaveVoiceRoom,
    toggleMute,
    toggleDeafen,
    toggleHandRaise,
  } = useVoiceRoom();

  const [showSettings, setShowSettings] = useState(false);
  const joinedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isConnected && !joinedAtRef.current) {
      joinedAtRef.current = Date.now();
      analyticsClient.track('voice_room_joined', { group_id: groupId }, groupId);
    }
    if (!isConnected && joinedAtRef.current) {
      const durationSeconds = Math.floor((Date.now() - joinedAtRef.current) / 1000);
      analyticsClient.track('voice_room_left', {
        group_id: groupId,
        duration_seconds: durationSeconds,
      }, groupId);
      joinedAtRef.current = null;
      onExpandedChange(false);
    }
  }, [isConnected, groupId, onExpandedChange]);

  if (!isConnected && participantCount === 0) return null;

  const getParticipantInitials = (name: string) =>
    name.split(' ').map((w) => w.charAt(0)).join('').toUpperCase().slice(0, 2);

  const getSpeakingIndicator = (participant: VoiceParticipant) => {
    if (participant.isMuted) return <MicOff className="h-3 w-3 text-red-500" />;
    if (participant.isDeafened) return <VolumeX className="h-3 w-3 text-orange-500" />;
    if (participant.isSpeaking) {
      return (
        <div className="flex items-center gap-1">
          <Mic className="h-3 w-3 text-green-500" />
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        </div>
      );
    }
    return <Mic className="h-3 w-3 text-gray-400" />;
  };

  const handleLeave = async () => {
    await leaveVoiceRoom();
    onExpandedChange(false);
  };

  if (!expanded) return null;

  return (
    <Card className={cn(
      'mx-3 sm:mx-4 my-2 border-2 border-green-500 shadow-lg transition-all duration-300',
      'max-h-[70vh] overflow-hidden'
    )}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => onExpandedChange(false)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-green-500" />
            Voice Room
            <Badge variant="secondary" className="text-xs">{groupName}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {participantCount}
            </Badge>
            <ChevronUp className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 overflow-y-auto">
        <div className="flex gap-2">
          <Button variant={isMuted ? 'destructive' : 'default'} size="sm" onClick={toggleMute} className="flex-1">
            {isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
            {isMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant={isDeafened ? 'destructive' : 'outline'} size="sm" onClick={toggleDeafen} className="flex-1">
            {isDeafened ? <VolumeX className="h-4 w-4 mr-2" /> : <Headphones className="h-4 w-4 mr-2" />}
            {isDeafened ? 'Undeafen' : 'Deafen'}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant={handRaised ? 'default' : 'outline'}
            size="sm"
            onClick={toggleHandRaise}
            className={cn('flex-1', handRaised && 'bg-yellow-500 hover:bg-yellow-600 text-white')}
          >
            <Hand className="h-4 w-4 mr-2" />
            {handRaised ? 'Lower Hand' : 'Raise Hand'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="flex-1">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants ({participantCount})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.userId}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg',
                  participant.isSpeaking ? 'bg-green-50 border border-green-200' : 'bg-muted/50',
                  participant.handRaised && 'bg-yellow-50 border border-yellow-200'
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{getParticipantInitials(participant.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate text-sm font-medium">{participant.name}</div>
                {getSpeakingIndicator(participant)}
              </div>
            ))}
          </div>
        </div>

        {showSettings && (
          <div className="p-3 bg-muted rounded-lg text-xs space-y-2">
            <div className="flex justify-between"><span>Microphone</span><Badge>{isMuted ? 'Muted' : 'Active'}</Badge></div>
            <div className="flex justify-between"><span>Audio Output</span><Badge>{isDeafened ? 'Deafened' : 'Active'}</Badge></div>
          </div>
        )}

        <Button variant="destructive" size="sm" onClick={handleLeave} className="w-full">
          <PhoneOff className="h-4 w-4 mr-2" />
          Leave Voice Room
        </Button>
      </CardContent>
    </Card>
  );
};
