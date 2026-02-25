import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"

interface QualityControlProps {
  quality: number
  onQualityChange: (value: number) => void
}

export function QualityControl({ quality, onQualityChange }: QualityControlProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label>Compression Quality</Label>
          <span className="text-sm font-medium text-muted-foreground">{quality}%</span>
        </div>
        <Slider
          value={[quality]}
          onValueChange={(value) => onQualityChange(value[0])}
          min={10}
          max={100}
          step={5}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Recommended 70-85% for optimal quality and size balance
        </p>
      </CardContent>
    </Card>
  )
}
