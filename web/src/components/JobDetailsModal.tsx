import React, { useState, useEffect } from 'react';
import { Job, JobMatchResult } from '../types/job';
import {
  X,
  Building2,
  MapPin,
  Briefcase,
  IndianRupee,
  ExternalLink,
  CheckCircle2,
  Zap,
  FileCode2,
  MailCheck,
  Bookmark,
  Target,
  AlertCircle,
  CloudSun,
  Navigation,
  Train,
  Car,
  Wind,
} from 'lucide-react';
import { fetchWeatherAndAqi, WeatherAqiData } from '../lib/weatherService';
import {
  POPULAR_INDIAN_TRANSIT_HUBS,
  estimateCommute,
  CommuteEstimate,
} from '../lib/commuteService';

interface JobDetailsModalProps {
  job: Job | null;
  isSaved?: boolean;
  matchResult?: JobMatchResult;
  onClose: () => void;
  onToggleSave?: () => void;
  onAuditResume?: (job: Job) => void;
  onGenerateResume?: (job: Job) => void;
  onVerifyRecruiter?: (job: Job) => void;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  job,
  isSaved,
  matchResult,
  onClose,
  onToggleSave,
  onAuditResume,
  onGenerateResume,
  onVerifyRecruiter,
}) => {
  // Live Weather & AQI State
  const [weatherData, setWeatherData] = useState<WeatherAqiData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Commute Estimator State
  const [selectedTransitHubId, setSelectedTransitHubId] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [commuteEstimate, setCommuteEstimate] = useState<CommuteEstimate | null>(null);

  useEffect(() => {
    if (!job) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [job, onClose]);

  // Load weather when job changes
  useEffect(() => {
    if (!job?.lat || !job?.lon) {
      setWeatherData(null);
      return;
    }
    let isCancelled = false;
    setIsLoadingWeather(true);
    fetchWeatherAndAqi(job.lat, job.lon)
      .then((data) => {
        if (!isCancelled) {
          setWeatherData(data);
          setIsLoadingWeather(false);
        }
      })
      .catch(() => {
        if (!isCancelled) setIsLoadingWeather(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [job?.lat, job?.lon]);

  // Update commute estimate when selection or user location changes
  useEffect(() => {
    if (!job?.lat || !job?.lon) {
      setCommuteEstimate(null);
      return;
    }

    let originLat: number | null = null;
    let originLon: number | null = null;

    if (userLocation) {
      originLat = userLocation.lat;
      originLon = userLocation.lon;
    } else if (selectedTransitHubId) {
      const landmark = POPULAR_INDIAN_TRANSIT_HUBS.find((h) => h.id === selectedTransitHubId);
      if (landmark) {
        originLat = landmark.lat;
        originLon = landmark.lon;
      }
    }

    if (originLat !== null && originLon !== null) {
      const est = estimateCommute(originLat, originLon, job.lat, job.lon);
      setCommuteEstimate(est);
    } else {
      setCommuteEstimate(null);
    }
  }, [job?.lat, job?.lon, userLocation, selectedTransitHubId]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setSelectedTransitHubId('');
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          name: 'Your Current GPS Location',
        });
      },
      (err) => {
        setIsLocating(false);
        alert(`Could not fetch location: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleTransitHubChange = (hubId: string) => {
    setSelectedTransitHubId(hubId);
    setUserLocation(null);
  };

  if (!job) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-details-title"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 sm:p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close job details dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {job.company_logo ? (
              <img
                src={job.company_logo}
                alt={job.company}
                className="h-14 w-14 rounded-xl border border-zinc-100 object-contain p-1 dark:border-zinc-800 dark:bg-zinc-800"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Building2 className="h-7 w-7" />
              </div>
            )}
            <div>
              <h2 id="job-details-title" className="text-lg font-bold text-zinc-900 dark:text-white">{job.title}</h2>
              <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">{job.company}</p>
            </div>
          </div>
          
          {onToggleSave && (
            <button
              onClick={onToggleSave}
              className={`mr-8 p-2 rounded-lg border transition ${
                isSaved 
                  ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400' 
                  : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
              }`}
              title={isSaved ? "Remove from saved" : "Save job"}
            >
              <Bookmark className="h-5 w-5" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3.5 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <MapPin className="h-4 w-4 text-rose-500" />
            <span>{job.hub || job.city}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <IndianRupee className="h-4 w-4 text-emerald-500" />
            <span>{job.salary_range || 'Competitive'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <Briefcase className="h-4 w-4 text-blue-500" />
            <span>{job.workplace_model} · {job.job_type || 'Full-time'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <CheckCircle2 className="h-4 w-4 text-purple-500" />
            <span>{job.experience_yoe || job.experience_level}</span>
          </div>
        </div>

        {/* 🌤️ Live Weather & AQI Corridor Intelligence (Open-Meteo Free Keyless API) */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-zinc-200/80 bg-gradient-to-r from-sky-50/60 to-blue-50/40 p-2.5 dark:border-zinc-800 dark:from-sky-950/20 dark:to-blue-950/20">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <CloudSun className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {weatherData ? `${weatherData.temperature}°C` : isLoadingWeather ? 'Updating...' : '--°C'}
                </span>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  · {weatherData?.weatherCondition || 'Corridor Weather'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                <Wind className="h-3 w-3 text-zinc-400" />
                <span>Wind {weatherData?.windSpeed ?? '--'} km/h</span>
                <span>· Humidity {weatherData?.relativeHumidity ?? '--'}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-zinc-500">AQI</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  !weatherData
                    ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                    : weatherData.aqiCategory === 'Good' || weatherData.aqiCategory === 'Fair'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : weatherData.aqiCategory === 'Moderate'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}
              >
                {weatherData ? `${weatherData.aqi} (${weatherData.aqiCategory})` : 'Live AQI'}
              </span>
            </div>
            <span className="text-[9px] text-zinc-400">PM2.5: {weatherData?.pm25 ?? '--'} µg/m³</span>
          </div>
        </div>

        {/* 🚗 Indian Commute & Distance Estimator */}
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Navigation className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                Commute Distance & Travel Time
              </span>
            </div>
            <button
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              <Navigation className="h-3 w-3 text-blue-500" />
              <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
            </button>
          </div>

          <div className="mt-2.5">
            <select
              value={userLocation ? 'custom' : selectedTransitHubId}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  handleTransitHubChange(e.target.value);
                }
              }}
              className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {userLocation && (
                <option value="custom">📍 {userLocation.name}</option>
              )}
              <option value="">-- Choose Indian Metro / Tech Landmark --</option>
              {POPULAR_INDIAN_TRANSIT_HUBS.map((hub) => (
                <option key={hub.id} value={hub.id}>
                  {hub.name} ({hub.city})
                </option>
              ))}
            </select>
          </div>

          {commuteEstimate && (
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-200/80 pt-2.5 dark:border-zinc-700">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold text-zinc-500">Distance</span>
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  {commuteEstimate.roadDistanceKm} km
                  <span className="text-[10px] font-normal text-zinc-400"> (road)</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                  <Car className="h-3 w-3 text-amber-500" />
                  Peak Drive
                </span>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  ~{commuteEstimate.drivePeakMinutes} mins
                </span>
              </div>
              <div className="flex flex-col">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                  <Train className="h-3 w-3 text-blue-500" />
                  Metro Transit
                </span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  ~{commuteEstimate.metroTransitMinutes} mins
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Resume Match Alignment Radar */}
        {matchResult && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Resume Alignment Radar
                </h4>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  matchResult.matchScore >= 70
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : matchResult.matchScore >= 50
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {matchResult.matchScore}% Match
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  Matched Skills ({matchResult.matchedSkills.length})
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {matchResult.matchedSkills.length > 0 ? (
                    matchResult.matchedSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded bg-emerald-100/80 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
                      >
                        ✓ {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-zinc-400">None</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                  Missing Gaps ({matchResult.missingSkills.length})
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {matchResult.missingSkills.length > 0 ? (
                    matchResult.missingSkills.map((s, i) => (
                      <span
                        key={i}
                        className="rounded bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/80 dark:text-amber-200"
                      >
                        • {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">All skills covered!</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {job.skills && job.skills.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Required Skills</h4>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.skills.map((skill, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-950/40 dark:text-blue-400"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 🚀 CareerForge Deterministic Action Utilities Grid */}
        <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/30">
          <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
            ⚡ Career Acceleration Utilities
          </h4>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            Tailor your application and verify recruiter outreach with deterministic engines:
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              onClick={() => onAuditResume?.(job)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white py-3 px-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:border-blue-900/60 dark:bg-zinc-800 dark:text-blue-300 dark:hover:bg-zinc-700"
            >
              <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Audit Resume</span>
            </button>

            <button
              onClick={() => onGenerateResume?.(job)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white py-3 px-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-zinc-800 dark:text-emerald-300 dark:hover:bg-zinc-700"
            >
              <FileCode2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Generate ATS Resume</span>
            </button>

            <button
              onClick={() => onVerifyRecruiter?.(job)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-white py-3 px-2 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50 dark:border-purple-900/60 dark:bg-zinc-800 dark:text-purple-300 dark:hover:bg-zinc-700"
            >
              <MailCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Verify Recruiter</span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4 pb-4 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Close
          </button>
          {job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700"
            >
              <span>Apply Directly</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
