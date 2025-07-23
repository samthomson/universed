import { useState } from 'react';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface VoiceControlsProps {
  className?: string;
}

export function VoiceControls({ className }: VoiceControlsProps) {
  const [masterVolume, setMasterVolume] = useState([100]);
  const [micVolume, setMicVolume] = useState([100]);
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [autoGainControl, setAutoGainControl] = useState(true);

  const handleMasterVolumeChange = (value: number[]) => {
    setMasterVolume(value);
    // Apply volume to all remote audio elements
    const audioElements = document.querySelectorAll('audio[data-voice-channel]');
    audioElements.forEach((audio) => {
      (audio as HTMLAudioElement).volume = value[0] / 100;
    });
  };

  const handleMicVolumeChange = (value: number[]) => {
    setMicVolume(value);
    // Store microphone volume preference for future audio stream configuration
    localStorage.setItem('voice-mic-volume', value[0].toString());
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className={className}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Voice Settings</h4>
            <p className="text-sm text-muted-foreground">
              Adjust your voice chat settings
            </p>
          </div>

          <Separator />

          {/* Master Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="master-volume" className="text-sm font-medium">
                Master Volume
              </Label>
              <span className="text-sm text-muted-foreground">
                {masterVolume[0]}%
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <Slider
                id="master-volume"
                value={masterVolume}
                onValueChange={handleMasterVolumeChange}
                max={100}
                step={1}
                className="flex-1"
              />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Microphone Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mic-volume" className="text-sm font-medium">
                Microphone Volume
              </Label>
              <span className="text-sm text-muted-foreground">
                {micVolume[0]}%
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <VolumeX className="w-4 h-4 text-muted-foreground" />
              <Slider
                id="mic-volume"
                value={micVolume}
                onValueChange={handleMicVolumeChange}
                max={100}
                step={1}
                className="flex-1"
              />
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          <Separator />

          {/* Audio Processing */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Audio Processing</Label>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="noise-suppression" className="text-sm">
                  Noise Suppression
                </Label>
                <p className="text-xs text-muted-foreground">
                  Reduce background noise
                </p>
              </div>
              <Switch
                id="noise-suppression"
                checked={noiseSuppression}
                onCheckedChange={setNoiseSuppression}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="echo-cancellation" className="text-sm">
                  Echo Cancellation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Prevent audio feedback
                </p>
              </div>
              <Switch
                id="echo-cancellation"
                checked={echoCancellation}
                onCheckedChange={setEchoCancellation}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-gain" className="text-sm">
                  Auto Gain Control
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically adjust volume
                </p>
              </div>
              <Switch
                id="auto-gain"
                checked={autoGainControl}
                onCheckedChange={setAutoGainControl}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}