import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import LoadingSpinner from './LoadingSpinner';

const HeroSlider = () => {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSlides = async () => {
            try {
                const { data, error } = await supabase
                    .from('slides')
                    .select('*')
                    .order('order_index', { ascending: true });

                if (error) {
                    console.error('Erro ao carregar slides:', error);
                    setLoading(false);
                    return;
                }

                if (data && data.length > 0) {
                    const activeSlides = data.filter(slide => slide.active === true);
                    const formattedSlides = activeSlides.map(slide => ({
                        id: slide.id,
                        image: slide.image_url,
                        title: slide.title,
                        link: slide.link
                    }));
                    setSlides(formattedSlides);
                }
                setLoading(false);
            } catch (err) {
                console.error('Erro ao carregar slides:', err);
                setLoading(false);
            }
        };

        loadSlides();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length]);

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    };

    const goToSlide = (index) => {
        setCurrentSlide(index);
    };

    if (slides.length === 0) {
        return null;
    }

    return (
        <div className="relative w-full bg-white">
            {/* Desktop Layout */}
            <div className="hidden md:flex gap-4">
                {/* Main Slide */}
                <div className="relative flex-1 h-[510px] overflow-hidden rounded-lg group">
                    {slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            onClick={() => slide.link && navigate(slide.link)}
                            className={`absolute inset-0 transition-opacity duration-700 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                } ${slide.link ? 'cursor-pointer' : ''}`}
                        >
                            <img
                                src={slide.image}
                                alt={slide.title || `Slide ${index + 1}`}
                                loading={index === 0 ? "eager" : "lazy"}
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}

                    {/* Navigation Arrows - aparecem ao passar o mouse */}
                    <button
                        onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/40 hover:bg-black/60 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                    >
                        <ChevronRight className="w-5 h-5 text-white" />
                    </button>

                    {/* Dots Indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex space-x-2">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`h-2 rounded-full transition-all ${index === currentSlide ? 'bg-red-600 w-8' : 'bg-white/50 w-2'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Thumbnails on the right - scrollable if more than 5 */}
                <div className="hidden lg:flex flex-col gap-2 w-48 overflow-y-auto">
                    {slides.map((slide, index) => (
                        <button
                            key={slide.id}
                            onClick={() => goToSlide(index)}
                            className={`relative h-[95px] overflow-hidden rounded-lg transition-all flex-shrink-0 ${index === currentSlide
                                    ? 'ring-2 ring-red-600 opacity-100'
                                    : 'opacity-70 hover:opacity-100'
                                }`}
                        >
                            <img
                                src={slide.image}
                                alt={`Thumbnail ${index + 1}`}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden flex flex-col gap-3">
                {/* Main Slide - Grande no topo */}
                <div className="relative w-full h-[220px] overflow-hidden rounded-lg group">
                    {slides.map((slide, index) => (
                        <div
                            key={slide.id}
                            onClick={() => slide.link && navigate(slide.link)}
                            className={`absolute inset-0 transition-opacity duration-700 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                                } ${slide.link ? 'cursor-pointer' : ''}`}
                        >
                            <img
                                src={slide.image}
                                alt={slide.title || `Slide ${index + 1}`}
                                loading={index === 0 ? "eager" : "lazy"}
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}

                    {/* Dots Indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex space-x-1">
                        {slides.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToSlide(index)}
                                className={`h-1.5 rounded-full transition-all ${index === currentSlide ? 'bg-red-600 w-6' : 'bg-white/50 w-1.5'
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Thumbnails - 2 colunas abaixo - max 5 items */}
                <div className="grid grid-cols-2 gap-3 max-h-[440px] overflow-y-auto">
                    {slides.slice(0, 5).map((slide, index) => (
                        <button
                            key={slide.id}
                            onClick={() => goToSlide(index)}
                            className={`relative h-[100px] overflow-hidden rounded-lg transition-all flex-shrink-0 ${index === currentSlide
                                    ? 'ring-2 ring-red-600 opacity-100'
                                    : 'opacity-70 hover:opacity-100'
                                }`}
                        >
                            <img
                                src={slide.image}
                                alt={`Thumbnail ${index + 1}`}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HeroSlider;
