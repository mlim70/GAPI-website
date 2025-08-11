import { Image } from 'lucide-react';

interface PlaceholderImageProps {
  width?: number;
  height?: number;
  text?: string;
  className?: string;
}

export default function PlaceholderImage({ 
  width, 
  height, 
  text = "Event Image", 
  className = "" 
}: PlaceholderImageProps) {
  const style = width && height ? { width: `${width}px`, height: `${height}px` } : {};
  
  return (
    <div 
      className={`bg-gradient-to-br from-red to-neutral-dark flex items-center justify-center text-white font-semibold text-lg ${className}`}
      style={style}
    >
      <div className="text-center">
        <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>{text}</p>
      </div>
    </div>
  );
} 
