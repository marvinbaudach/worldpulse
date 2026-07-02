import { useState } from 'react';
import { Carousel3D } from './components/Carousel3D';
import { LoadingScreen } from './components/LoadingScreen';
import { useImagePreloader } from './hooks/useImagePreloader';
import { IMAGES } from './data/images';
import './App.css';

const IMAGE_URLS = IMAGES.map((img) => img.url);

export default function App() {
  const { progress, done } = useImagePreloader(IMAGE_URLS);
  const [showLoader, setShowLoader] = useState(true);
  // Mount the carousel only once images are cached -> no stutter.
  const [mountScene, setMountScene] = useState(false);

  if (done && !mountScene) setMountScene(true);

  return (
    <main className="stage">
      {mountScene && <Carousel3D />}

      {showLoader && (
        <LoadingScreen
          progress={progress}
          done={done}
          onExited={() => setShowLoader(false)}
        />
      )}
    </main>
  );
}
