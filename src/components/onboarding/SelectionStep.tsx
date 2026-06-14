import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SelectionStepProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  options: readonly string[];
  mode: 'single' | 'multi';
  values: string | string[];
  onChange: (values: string | string[]) => void;
  min?: number;
  max?: number;
}

export const SelectionStep = ({
  title,
  description,
  icon,
  options,
  mode,
  values,
  onChange,
  min,
  max,
}: SelectionStepProps) => {
  const selectedArray = mode === 'single' ? (values ? [values as string] : []) : (values as string[]);

  const handleToggle = (option: string) => {
    if (mode === 'single') {
      onChange(option);
      return;
    }

    const current = values as string[];
    if (current.includes(option)) {
      onChange(current.filter((item) => item !== option));
    } else if (!max || current.length < max) {
      onChange([...current, option]);
    }
  };

  const isSelected = (option: string) => selectedArray.includes(option);
  const isDisabled = (option: string) =>
    mode === 'multi' &&
    !isSelected(option) &&
    !!max &&
    selectedArray.length >= max;

  const selectionHint =
    mode === 'single'
      ? 'Choose one'
      : max
        ? `Choose ${min ? `${min}–` : 'up to '}${max}`
        : 'Select all that apply';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{selectionHint}</p>
        </div>
      </div>
      <p className="text-muted-foreground">{description}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {options.map((option) => (
          <Button
            key={option}
            variant={isSelected(option) ? 'tag-selected' : 'tag'}
            onClick={() => handleToggle(option)}
            disabled={isDisabled(option)}
            className="h-auto py-3 px-4 text-left"
          >
            {option}
          </Button>
        ))}
      </div>
      {selectedArray.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="text-sm text-muted-foreground">
            <strong>Selected ({selectedArray.length}{max ? `/${max}` : ''}):</strong>{' '}
            {selectedArray.join(', ')}
          </div>
        </Card>
      )}
    </div>
  );
};
