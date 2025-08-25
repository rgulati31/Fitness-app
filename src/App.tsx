import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Save,
  Download,
  Upload,
  Trash2,
  Calculator,
  Target,
  Dumbbell,
  Calendar as CalIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
} from 'recharts';

// ------------------------------
// Helpers
// ------------------------------
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : '-');
const todayISO = () => new Date().toISOString().slice(0, 10);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const macroCalories = (p = 0, c = 0, f = 0) => p * 4 + c * 4 + f * 9;

const defaultTargets = {
  calories: 1800,
  protein: 130,
  carbs: 160,
  fat: 60,
  goalWeight: 150,
};

const emptyDay = (dateStr) => ({
  date: dateStr || todayISO(),
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  exercises: [], // entries with cascading selects
});

const defaultState = {
  targets: defaultTargets,
  days: [emptyDay(todayISO())],
};

const STORAGE_KEY = 'fitness-tracker-v1';

// Exercise catalog (from your image)
const EXERCISE_TREE = {
  Cardio: {
    LISS: {
      '-': ['Treadmill', 'Stair Master', 'Elliptical'],
    },
    HIIT: {
      '-': ['Treadmill', 'Stair Master', 'Elliptical'],
    },
  },
  Strength: {
    Pull: {
      Back: [
        'Seated low row',
        'Lat pulldown (wide grip)',
        'Lat pulldown (short grip)',
        'Bent over row',
      ],
      Bicep: ['EZ bar curl', 'Dumbbell hammer curl', 'Cable rope curl'],
    },
    Push: {
      Chest: ['Flat bench press', 'Incline bench press', 'Cable chest fly'],
      Shoulders: [
        'Barbell or dumbbell shoulder press',
        'Lateral raise',
        'Front raise / Side raise / Around-the-world (alternate weekly)',
      ],
      Triceps: [
        'Cable triceps pushdown',
        'Bar triceps pushdown',
        'Overhead cable triceps extension',
      ],
    },
    Legs: {
      'Legs + Glutes + Calves': [
        'Dumbbell squat (shoulder hold)',
        'Sumo squat (front hold)',
        'Romanian deadlift',
        'Curtsy lunge / Side lunge (alternate weekly)',
        'Standing calf raise',
        'Seated calf raise',
      ],
    },
  },
};

const getTypes = (cat) =>
  cat && EXERCISE_TREE[cat] ? Object.keys(EXERCISE_TREE[cat]) : [];
const getGroups = (cat, type) =>
  cat && type && EXERCISE_TREE[cat]?.[type]
    ? Object.keys(EXERCISE_TREE[cat][type])
    : [];
const getExercises = (cat, type, group) =>
  cat && type && group && EXERCISE_TREE[cat]?.[type]?.[group]
    ? EXERCISE_TREE[cat][type][group]
    : [];

// Macro calculator (Protein: 1g/lb goal weight; Fat: 25% of cals / 9; Carbs: remainder / 4)
function computeMacros(goalWeight, calories) {
  if (!goalWeight || !calories) return null;
  const proteinGrams = goalWeight; // 1 g per lb
  const proteinCalories = proteinGrams * 4;
  const fatCalories = calories * 0.25;
  const fatGrams = fatCalories / 9;
  const carbCalories = calories - (proteinCalories + fatCalories);
  const carbGrams = carbCalories / 4;
  return {
    calories: Math.round(calories),
    protein: Math.round(proteinGrams),
    fat: Math.round(fatGrams),
    carbs: Math.max(0, Math.round(carbGrams)), // avoid negatives when calories are very low
  };
}

export default function App() {
  const [state, setState] = useState(defaultState);
  const [activeIdx, setActiveIdx] = useState(0);
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(null);
  const fileInputRef = useRef(null);

  // Load from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.days && parsed.days.length) {
          setState({
            targets: { ...defaultTargets, ...(parsed.targets || {}) },
            days: parsed.days.map((d) => ({
              date: d.date || todayISO(),
              calories: d.calories ?? '',
              protein: d.protein ?? '',
              carbs: d.carbs ?? '',
              fat: d.fat ?? '',
              exercises: Array.isArray(d.exercises) ? d.exercises : [],
            })),
          });
          setActiveIdx(0);
        }
      }
    } catch (e) {
      console.error('Failed to load:', e);
    }
  }, []);

  // Save to storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save:', e);
    }
  }, [state]);

  // Exports / Import
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-tracker-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = [
      'date',
      'calories',
      'protein',
      'carbs',
      'fat',
      'exercises(c/t/g/name/wt/sets/reps/dur)',
    ];
    const rows = state.days
      .map((d) => {
        const ex = (d.exercises || [])
          .map(
            (e) =>
              `${e.category || ''}/${e.type || ''}/${e.group || ''}/${
                e.name || ''
              }/${e.weight || 0}/${e.sets || 0}/${e.reps || 0}/${
                e.duration || 0
              }`
          )
          .join(' | ');
        return [
          d.date,
          d.calories || 0,
          d.protein || 0,
          d.carbs || 0,
          d.fat || 0,
          ex,
        ];
      })
      .map((arr) =>
        arr.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')
      )
      .join('\n');
    const csv = [headers.join(','), rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed?.days?.length) {
          setState({
            targets: { ...defaultTargets, ...(parsed.targets || {}) },
            days: parsed.days,
          });
          setActiveIdx(0);
        }
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- Tiny test suite (runs once; see console) ----
  useEffect(() => {
    const t1 = computeMacros(150, 1800);
    console.assert(
      t1 && t1.protein === 150 && t1.fat === 50 && t1.carbs === 188,
      'Test 1 failed',
      t1
    );
    const t2 = computeMacros(120, 1600);
    console.assert(
      t2 && t2.protein === 120 && t2.fat === 44 && t2.carbs === 180,
      'Test 2 failed',
      t2
    );
    const t3 = computeMacros(0, 1600);
    console.assert(t3 === null, 'Test 3 failed (null for missing inputs)');
    const t4 = computeMacros(200, 1000);
    console.assert(
      t4 && t4.carbs >= 0,
      'Test 4 failed (carbs should be clamped >= 0)',
      t4
    );
    const t5 = computeMacros(185, 2200);
    console.assert(
      t5 &&
        t5.protein === 185 &&
        typeof t5.fat === 'number' &&
        typeof t5.carbs === 'number',
      'Test 5 failed',
      t5
    );
    // Additional sanity tests for the exercise tree
    const cardioNames = getExercises('Cardio', 'LISS', '-');
    console.assert(
      Array.isArray(cardioNames) && cardioNames.length === 3,
      'Tree test failed for Cardio/LISS'
    );
    const groupsPull = getGroups('Strength', 'Pull');
    console.assert(
      groupsPull.includes('Back') && groupsPull.includes('Bicep'),
      'Tree test failed for Strength/Pull'
    );
  }, []);

  const activeDay = state.days[activeIdx] || emptyDay(todayISO());

  const setActiveDay = (partial) => {
    setState((prev) => {
      const days = [...prev.days];
      days[activeIdx] = { ...days[activeIdx], ...partial };
      return { ...prev, days };
    });
  };

  const addNewDay = () => {
    const nextDate = todayISO();
    setState((prev) => ({ ...prev, days: [emptyDay(nextDate), ...prev.days] }));
    setActiveIdx(0);
  };

  const deleteDay = (idx) => {
    setState((prev) => {
      const days = prev.days.filter((_, i) => i !== idx);
      return { ...prev, days: days.length ? days : [emptyDay(todayISO())] };
    });
    setActiveIdx((prev) => Math.max(0, prev - 1));
    setDeleteConfirmIdx(null);
  };

  const addExercise = () => {
    const ex = {
      category: '',
      type: '',
      group: '',
      name: '',
      weight: '',
      sets: '',
      reps: '',
      duration: '',
    };
    setActiveDay({ exercises: [...(activeDay.exercises || []), ex] });
  };

  const updateExercise = (exIdx, partial) => {
    setState((prev) => {
      const days = [...prev.days];
      const d = { ...days[activeIdx] };
      const exs = [...(d.exercises || [])];
      exs[exIdx] = { ...exs[exIdx], ...partial };
      d.exercises = exs;
      days[activeIdx] = d;
      return { ...prev, days };
    });
  };

  // NEW: define removeExercise (fixes ReferenceError)
  const removeExercise = (exIdx) => {
    setState((prev) => {
      const days = [...prev.days];
      const d = { ...days[activeIdx] };
      d.exercises = (d.exercises || []).filter((_, i) => i !== exIdx);
      days[activeIdx] = d;
      return { ...prev, days };
    });
  };

  const replaceExerciseWithAll = (exIdx, cat, type, group, names) => {
    setState((prev) => {
      const days = [...prev.days];
      const d = { ...days[activeIdx] };
      const exs = [...(d.exercises || [])];
      // Remove current row and insert one row per exercise
      exs.splice(
        exIdx,
        1,
        ...names.map((n) => ({
          category: cat,
          type,
          group,
          name: n,
          weight: '',
          sets: '',
          reps: '',
          duration: '',
        }))
      );
      d.exercises = exs;
      days[activeIdx] = d;
      return { ...prev, days };
    });
  };

  const weeklyData = useMemo(() => {
    const sorted = [...state.days].sort((a, b) => (a.date > b.date ? 1 : -1));
    const last7 = sorted.slice(-7);
    return last7.map((d) => ({
      date: d.date?.slice(5) || '',
      calories: Number(d.calories) || 0,
      protein: Number(d.protein) || 0,
      carbs: Number(d.carbs) || 0,
      fat: Number(d.fat) || 0,
    }));
  }, [state.days]);

  const totals = useMemo(() => {
    const week = weeklyData;
    const sum = week.reduce(
      (acc, d) => ({
        calories: acc.calories + d.calories,
        protein: acc.protein + d.protein,
        carbs: acc.carbs + d.carbs,
        fat: acc.fat + d.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const avg = {
      calories: Math.round(sum.calories / Math.max(1, week.length)),
      protein: Math.round(sum.protein / Math.max(1, week.length)),
      carbs: Math.round(sum.carbs / Math.max(1, week.length)),
      fat: Math.round(sum.fat / Math.max(1, week.length)),
    };
    return { sum, avg };
  }, [weeklyData]);

  const macroCal = macroCalories(
    Number(activeDay.protein) || 0,
    Number(activeDay.carbs) || 0,
    Number(activeDay.fat) || 0
  );
  const calDelta = (Number(activeDay.calories) || 0) - macroCal;

  const recalcMacros = (goalWeight, calories) => {
    const m = computeMacros(goalWeight, calories);
    if (!m) return;
    setState((prev) => ({
      ...prev,
      targets: {
        ...prev.targets,
        ...m,
        goalWeight,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header with actions */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-6 h-6" />
            <h1 className="text-xl md:text-2xl font-semibold">
              Fitness & Macro Tracker
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addNewDay}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> New Day
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <button
              onClick={exportJSON}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
            >
              <Save className="w-4 h-4" /> JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border"
            >
              <Upload className="w-4 h-4" /> Import
            </button>
            <input
              ref={fileInputRef}
              onChange={importJSON}
              type="file"
              accept="application/json"
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Days list */}
        <section className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow p-3">
            <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
              <CalIcon className="w-5 h-5" />
              Days
            </h2>
            <ul className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {state.days.map((d, i) => {
                const mcal = macroCalories(
                  Number(d.protein) || 0,
                  Number(d.carbs) || 0,
                  Number(d.fat) || 0
                );
                const mismatch = (Number(d.calories) || 0) - mcal;
                return (
                  <li
                    key={i}
                    className={`border rounded-xl p-3 ${
                      i === activeIdx ? 'ring-2 ring-black' : ''
                    }`}
                    onClick={() => setActiveIdx(i)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          {d.date || '(no date)'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {fmt(Number(d.calories) || 0)} kcal • P{' '}
                          {fmt(Number(d.protein) || 0)} • C{' '}
                          {fmt(Number(d.carbs) || 0)} • F{' '}
                          {fmt(Number(d.fat) || 0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mismatch !== 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                            Δ {mismatch}
                          </span>
                        )}
                        {deleteConfirmIdx === i ? (
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteDay(i);
                              }}
                              className="text-red-600 text-xs"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmIdx(null);
                              }}
                              className="text-gray-500 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmIdx(i);
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Daily Targets */}
          <div className="bg-white rounded-2xl shadow p-4 mt-4">
            <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <Target className="w-5 h-5" />
              Daily Targets
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm col-span-2">
                <div className="text-gray-600 mb-1">Goal Weight (lbs)</div>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2"
                  value={state.targets.goalWeight ?? ''}
                  onChange={(e) =>
                    recalcMacros(
                      Number(e.target.value) || 0,
                      state.targets.calories
                    )
                  }
                />
              </label>
              <label className="text-sm col-span-2">
                <div className="text-gray-600 mb-1">Target Calories</div>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2"
                  value={state.targets.calories ?? ''}
                  onChange={(e) =>
                    recalcMacros(
                      state.targets.goalWeight,
                      Number(e.target.value) || 0
                    )
                  }
                />
              </label>
              {['protein', 'carbs', 'fat'].map((k) => (
                <label key={k} className="text-sm">
                  <div className="text-gray-600 mb-1 capitalize">{k}</div>
                  <input
                    type="number"
                    className="w-full border rounded-xl px-3 py-2"
                    value={state.targets[k] ?? ''}
                    readOnly
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Protein: 1g/lb goal weight • Fat: 25% cal / 9 • Carbs: remaining
              cal / 4.
            </p>
          </div>
        </section>

        {/* Right: Active Day, Exercises, Charts, Summary */}
        <section className="lg:col-span-2 space-y-4">
          {/* Active Day Editor */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-semibold mb-3">Active Day Editor</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <label className="text-sm col-span-2">
                <div className="text-gray-600 mb-1">Date</div>
                <input
                  type="date"
                  className="w-full border rounded-xl px-3 py-2"
                  value={activeDay.date}
                  onChange={(e) => setActiveDay({ date: e.target.value })}
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Calories</div>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2"
                  value={activeDay.calories}
                  onChange={(e) =>
                    setActiveDay({
                      calories: clamp(Number(e.target.value) || 0, 0, 100000),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Protein (g)</div>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2"
                  value={activeDay.protein}
                  onChange={(e) =>
                    setActiveDay({
                      protein: clamp(Number(e.target.value) || 0, 0, 10000),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Carbs (g)</div>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2"
                  value={activeDay.carbs}
                  onChange={(e) =>
                    setActiveDay({
                      carbs: clamp(Number(e.target.value) || 0, 0, 10000),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Fat (g)</div>
                <input
                  type="number"
                  className="w-full border rounded-xl px-3 py-2"
                  value={activeDay.fat}
                  onChange={(e) =>
                    setActiveDay({
                      fat: clamp(Number(e.target.value) || 0, 0, 10000),
                    })
                  }
                />
              </label>
            </div>

            {/* Macro → Calories check */}
            <div className="mt-4 p-3 rounded-xl bg-gray-50 border text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>
                  Calories from macros:{' '}
                  <span className="font-medium">{macroCal}</span>
                </span>
              </div>
              <div>
                {calDelta === 0 ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    Perfect match
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                    Δ {calDelta > 0 ? '+' : ''}
                    {calDelta}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Exercises with cascading dropdowns */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                Exercises
              </h2>
              <button
                onClick={addExercise}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black text-white hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Add Exercise
              </button>
            </div>

            {(activeDay.exercises || []).length === 0 && (
              <p className="text-sm text-gray-600">
                No exercises yet. Click{' '}
                <span className="font-medium">Add Exercise</span> to start.
              </p>
            )}

            <div className="space-y-2">
              {(activeDay.exercises || []).map((ex, i) => {
                const categories = Object.keys(EXERCISE_TREE);
                const types = getTypes(ex.category);
                const groups = getGroups(ex.category, ex.type);
                const names = getExercises(ex.category, ex.type, ex.group);
                const isCardio = ex.category === 'Cardio';
                return (
                  <div key={i} className="border rounded-xl p-3">
                    <div className="grid grid-cols-2 md:grid-cols-8 gap-2 items-start">
                      {/* Category */}
                      <select
                        className="border rounded-xl px-2 py-2"
                        value={ex.category}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          if (newCat === 'Cardio') {
                            // force group to '-'; clear others
                            updateExercise(i, {
                              category: newCat,
                              type: '',
                              group: '-',
                              name: '',
                              weight: '',
                              sets: '',
                              reps: '',
                            });
                          } else {
                            updateExercise(i, {
                              category: newCat,
                              type: '',
                              group: '',
                              name: '',
                            });
                          }
                        }}
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      {/* Type */}
                      <select
                        className="border rounded-xl px-2 py-2"
                        value={ex.type}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isCardio) {
                            updateExercise(i, {
                              type: v,
                              group: '-',
                              name: '',
                            });
                          } else {
                            updateExercise(i, { type: v, group: '', name: '' });
                          }
                        }}
                        disabled={!types.length}
                      >
                        <option value="">Workout Type</option>
                        {types.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>

                      {/* Group */}
                      <select
                        className="border rounded-xl px-2 py-2"
                        value={isCardio ? '-' : ex.group}
                        onChange={(e) =>
                          updateExercise(i, { group: e.target.value, name: '' })
                        }
                        disabled={isCardio || !groups.length}
                      >
                        <option value="">Muscle Group</option>
                        {(isCardio ? ['-'] : groups).map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>

                      {/* Exercise Name */}
                      <select
                        className="border rounded-xl px-2 py-2 md:col-span-2"
                        value={ex.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__ALL__') {
                            replaceExerciseWithAll(
                              i,
                              ex.category,
                              ex.type,
                              isCardio ? '-' : ex.group,
                              names
                            );
                          } else {
                            updateExercise(i, { name: v });
                          }
                        }}
                        disabled={!names.length}
                      >
                        <option value="">Exercise</option>
                        {/* Offer All the above when type+group are chosen and we have multiple names */}
                        {ex.type &&
                          (isCardio || ex.group) &&
                          names.length > 1 && (
                            <option value="__ALL__">All the above</option>
                          )}
                        {names.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>

                      {/* Weight / Sets / Reps (hide for Cardio) */}
                      {!isCardio && (
                        <>
                          <input
                            type="number"
                            placeholder="Weight"
                            className="border rounded-xl px-3 py-2"
                            value={ex.weight}
                            onChange={(e) =>
                              updateExercise(i, {
                                weight: clamp(
                                  Number(e.target.value) || 0,
                                  0,
                                  10000
                                ),
                              })
                            }
                          />
                          <input
                            type="number"
                            placeholder="Sets"
                            className="border rounded-xl px-3 py-2"
                            value={ex.sets}
                            onChange={(e) =>
                              updateExercise(i, {
                                sets: clamp(
                                  Number(e.target.value) || 0,
                                  0,
                                  1000
                                ),
                              })
                            }
                          />
                          <input
                            type="number"
                            placeholder="Reps"
                            className="border rounded-xl px-3 py-2"
                            value={ex.reps}
                            onChange={(e) =>
                              updateExercise(i, {
                                reps: clamp(
                                  Number(e.target.value) || 0,
                                  0,
                                  10000
                                ),
                              })
                            }
                          />
                        </>
                      )}
                      {/* Duration always available */}
                      <input
                        type="number"
                        placeholder="Duration (min)"
                        className="border rounded-xl px-3 py-2"
                        value={ex.duration}
                        onChange={(e) =>
                          updateExercise(i, {
                            duration: clamp(
                              Number(e.target.value) || 0,
                              0,
                              10000
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="mt-2 text-right">
                      <button
                        onClick={() => removeExercise(i)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-red-600"
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">Last 7 Days — Calories</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="calories"
                      stroke="#000000"
                      dot
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-2">Last 7 Days — Macros (g)</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="protein" fill="#111111" />
                    <Bar dataKey="carbs" fill="#525252" />
                    <Bar dataKey="fat" fill="#9ca3af" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Weekly Summary */}
          <div className="bg-white rounded-2xl shadow p-4">
            <h3 className="font-semibold mb-3">Weekly Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-8 gap-3 text-sm">
              <div className="col-span-2 md:col-span-2 border rounded-2xl p-3">
                <div className="text-gray-600">Avg Calories</div>
                <div className="text-xl font-semibold">
                  {fmt(totals.avg.calories)}
                </div>
              </div>
              <div className="border rounded-2xl p-3">
                <div className="text-gray-600">Avg Protein</div>
                <div className="text-xl font-semibold">
                  {fmt(totals.avg.protein)} g
                </div>
              </div>
              <div className="border rounded-2xl p-3">
                <div className="text-gray-600">Avg Carbs</div>
                <div className="text-xl font-semibold">
                  {fmt(totals.avg.carbs)} g
                </div>
              </div>
              <div className="border rounded-2xl p-3">
                <div className="text-gray-600">Avg Fat</div>
                <div className="text-xl font-semibold">
                  {fmt(totals.avg.fat)} g
                </div>
              </div>
              <div className="col-span-2 md:col-span-2 border rounded-2xl p-3">
                <div className="text-gray-600">Days Tracked</div>
                <div className="text-xl font-semibold">{state.days.length}</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
