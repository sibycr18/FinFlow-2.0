import { useState, useEffect } from 'react';
import { format, differenceInMonths, addMonths, startOfMonth, subMonths, endOfMonth } from 'date-fns';
import { Target, Plus, Trash2, TrendingUp, AlertCircle, X, PlusCircle, Info, Wallet, Play, Pause, Loader2, Calendar, ArrowUp, ArrowDown, Clock, Repeat, PiggyBank } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase';
import { SavingsGoal, SavingsRecommendation, Category, Expense } from '../types';
import { createPortal } from 'react-dom';
import ContributionModal from './ContributionModal';
import { supabase } from '../lib/supabase';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    type ChartData,
    type ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const CATEGORIES: Category[] = ['investment', 'debt', 'needs', 'leisure'];

// Utility function for Indian number formatting (consistent with Dashboard)
const formatIndianNumber = (num: number): string => {
    const parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `₹${parts.join('.')}`;
};

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal: SavingsGoal;
    onConfirm: (deleteRecurring: boolean, deleteExpenses: boolean) => Promise<void>;
}

function DeleteConfirmationModal({ isOpen, onClose, goal, onConfirm }: DeleteConfirmationModalProps) {
    const [deleteExpenses, setDeleteExpenses] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm(true, deleteExpenses);
            onClose();
        } catch (error) {
            console.error('Error deleting goal:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Goal</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-1.5">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    The recurring transaction associated with this goal will also be deleted.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="deleteExpenses"
                                checked={deleteExpenses}
                                onChange={(e) => setDeleteExpenses(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-600 dark:focus:ring-blue-500"
                            />
                            <label htmlFor="deleteExpenses" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                                Delete all expenses linked to this goal from Dashboard
                            </label>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition-colors"
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={isDeleting}
                                className="rounded-lg bg-red-600 dark:bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 dark:hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-600 dark:focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 inline animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Goal'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}

interface GoalRecurringState {
    [goalId: string]: {
        hasRecurring: boolean;
        isActive: boolean;
        recurringId?: string;
        isLoading: boolean;
    };
}

interface GoalAnalyticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal: SavingsGoal;
}

function GoalAnalyticsModal({ isOpen, onClose, goal }: GoalAnalyticsModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [monthlyContributions, setMonthlyContributions] = useState(0);
    const [totalContributions, setTotalContributions] = useState(0);
    const [monthlyData, setMonthlyData] = useState<{ month: Date; amount: number }[]>([]);
    const [stats, setStats] = useState({
        totalContributions: 0,
        numContributions: 0,
        consistencyScore: 0,
        averageMonthlyContribution: 0
    });

    useEffect(() => {
        if (!isOpen || !user) return;
        
        const fetchExpenses = async () => {
            setIsLoading(true);
            try {
                // Fetch all expenses for this goal
                const startDate = subMonths(new Date(), 120); // Get all expenses up to 10 years back
                const endDate = new Date();
                const allExpenses = await db.expenses.getAll(user.id, startDate, endDate);
                const goalExpenses = allExpenses.filter(exp => exp.goal_id === goal.id);
                setExpenses(goalExpenses);

                // Calculate monthly contributions (current month)
                const currentMonthExpenses = goalExpenses.filter(exp => 
                    startOfMonth(new Date(exp.date)).getTime() === startOfMonth(new Date()).getTime()
                );
                setMonthlyContributions(currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0));

                // Calculate total contributions (all time)
                setTotalContributions(goalExpenses.reduce((sum, exp) => sum + exp.amount, 0));

                // Calculate monthly data
                const monthlyContributionsMap = new Map<string, number>();
                goalExpenses.forEach((expense) => {
                    const month = startOfMonth(new Date(expense.date));
                    const key = month.toISOString();
                    monthlyContributionsMap.set(key, (monthlyContributionsMap.get(key) || 0) + expense.amount);
                });

                // Convert to array and sort by date
                const monthlyDataArray = Array.from(monthlyContributionsMap.entries()).map(([date, amount]) => ({
                    month: new Date(date),
                    amount
                }));
                monthlyDataArray.sort((a, b) => a.month.getTime() - b.month.getTime());
                setMonthlyData(monthlyDataArray);

                // Calculate statistics
                const totalAmount = goalExpenses.reduce((sum, exp) => sum + exp.amount, 0);
                const numMonths = differenceInMonths(new Date(), startOfMonth(new Date()));
                const monthsWithContributions = monthlyContributionsMap.size;

                setStats({
                    totalContributions: totalAmount,
                    numContributions: goalExpenses.length,
                    consistencyScore: (monthsWithContributions / numMonths) * 100,
                    averageMonthlyContribution: totalAmount / numMonths
                });
            } catch (error) {
                console.error('Error fetching expenses:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchExpenses();
    }, [isOpen, goal.id, user?.id]);

    const chartData: ChartData<'line'> = {
        labels: monthlyData.map(d => format(d.month, 'MMM yyyy')),
        datasets: [
            {
                label: 'Monthly Contributions',
                data: monthlyData.map(d => d.amount),
                borderColor: 'rgb(59, 130, 246)', // blue
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                tension: 0.4
            }
        ]
    };

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: 'rgb(156, 163, 175)' // gray-400
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (context) => {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += formatIndianNumber(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(156, 163, 175, 0.1)' // gray-400 with opacity
                },
                ticks: {
                    color: 'rgb(156, 163, 175)' // gray-400
                }
            },
            y: {
                grid: {
                    color: 'rgba(156, 163, 175, 0.1)' // gray-400 with opacity
                },
                ticks: {
                    color: 'rgb(156, 163, 175)', // gray-400
                    callback: (value) => formatIndianNumber(value as number)
                }
            }
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                                {goal.name} - Analytics
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Track your progress and contribution patterns
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Progress Overview */}
                                <div className="space-y-4">
                                    {/* Progress Overview */}
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border border-blue-200 dark:border-blue-900">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                                <h3 className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    Current Progress
                                                </h3>
                                            </div>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                                                {formatIndianNumber(goal.current_amount)}
                                            </p>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border border-green-200 dark:border-green-900">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                <h3 className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    Target Amount
                                                </h3>
                                            </div>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                                                {formatIndianNumber(goal.target_amount)}
                                            </p>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border border-purple-200 dark:border-purple-900">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                                <h3 className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    Monthly Contribution
                                                </h3>
                                            </div>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                                                {formatIndianNumber(goal.monthly_contribution)}
                                            </p>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border border-orange-200 dark:border-orange-900">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                                                <h3 className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    Time Remaining
                                                </h3>
                                            </div>
                                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                                                {calculateTimeRemaining(goal.target_amount, goal.monthly_contribution, goal.current_amount)}
                                            </p>
                                        </div>

                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border border-red-200 dark:border-red-900">
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <PiggyBank className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                <h3 className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    Total Contributions
                                                </h3>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    This Month: {formatIndianNumber(monthlyContributions)}
                                                </p>
                                                <p className="text-xs font-medium text-gray-900 dark:text-gray-200">
                                                    All Time: {formatIndianNumber(totalContributions)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Contributions Chart */}
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-300 dark:border-gray-700 p-4">
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-4">Contribution History</h3>
                                        <div className="h-[300px]">
                                            <Line data={chartData} options={chartOptions} />
                                        </div>
                                    </div>

                                    {/* Recent Contributions */}
                                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-300 dark:border-gray-700 p-4">
                                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-3">Recent Contributions</h3>
                                        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                                                {expenses.length === 0 ? (
                                                    <div className="px-3 py-3 text-center text-gray-500 dark:text-gray-400">
                                                        No contributions yet
                                                    </div>
                                                ) : (
                                                    expenses.map((expense) => (
                                                        <div
                                                            key={expense.id}
                                                            className="flex items-center justify-between px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                                                    {expense.name}
                                                                </span>
                                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                    {format(new Date(expense.date), 'MMM d, yyyy')}
                                                                </span>
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                                                {formatIndianNumber(expense.amount)}
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}

// Calculate time remaining function (add this before the GoalAnalyticsModal component)
const calculateTimeRemaining = (targetAmount: number, monthlyContribution: number, currentAmount: number = 0) => {
    if (monthlyContribution <= 0) return 'No monthly contribution set';
    const remainingAmount = targetAmount - currentAmount;
    const monthsNeeded = Math.ceil(remainingAmount / monthlyContribution);
    const years = Math.floor(monthsNeeded / 12);
    const months = monthsNeeded % 12;
    
    let timeString = '';
    if (years > 0) {
        timeString += `${years} year${years > 1 ? 's' : ''}`;
        if (months > 0) timeString += ` and ${months} month${months > 1 ? 's' : ''}`;
    } else {
        timeString += `${months} month${months > 1 ? 's' : ''}`;
    }
    return timeString;
};

export default function SavingsGoals() {
    const { user } = useAuth();
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [recommendations, setRecommendations] = useState<SavingsRecommendation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
    const [isContributing, setIsContributing] = useState(false);
    const [newGoal, setNewGoal] = useState({
        name: '',
        target_amount: '',
        monthly_contribution: '1000',
        category: 'investment' as Category
    });
    const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);
    const [recurringStates, setRecurringStates] = useState<GoalRecurringState>({});
    const [selectedGoalForAnalytics, setSelectedGoalForAnalytics] = useState<SavingsGoal | null>(null);

    useEffect(() => {
        if (!user) return;
        fetchGoals();
    }, [user]);

    // Add this new function to check recurring status
    const checkRecurringStatus = async (goalId: string) => {
        setRecurringStates(prev => ({
            ...prev,
            [goalId]: { ...prev[goalId], isLoading: true }
        }));

        try {
            const { data: recurringTransactions } = await supabase
                .from('recurring_transactions')
                .select('id, active')
                .eq('goal_id', goalId)
                .eq('type', 'expense')
                .single();

            setRecurringStates(prev => ({
                ...prev,
                [goalId]: {
                    hasRecurring: !!recurringTransactions,
                    isActive: recurringTransactions?.active ?? false,
                    recurringId: recurringTransactions?.id,
                    isLoading: false
                }
            }));
        } catch (error) {
            console.error('Error checking recurring status:', error);
            setRecurringStates(prev => ({
                ...prev,
                [goalId]: {
                    hasRecurring: false,
                    isActive: false,
                    isLoading: false
                }
            }));
        }
    };

    // Add this to check recurring status when goals are loaded
    useEffect(() => {
        goals.forEach(goal => {
            checkRecurringStatus(goal.id);
        });
    }, [goals]);

    const handleRecurringToggle = async (goalId: string) => {
        const state = recurringStates[goalId];
        if (!state?.hasRecurring || !state.recurringId) return;

        setRecurringStates(prev => ({
            ...prev,
            [goalId]: { ...prev[goalId], isLoading: true }
        }));

        try {
            const { data: updatedTx, error } = await supabase
                .from('recurring_transactions')
                .update({ active: !state.isActive })
                .eq('id', state.recurringId)
                .select()
                .single();

            if (error) throw error;

            setRecurringStates(prev => ({
                ...prev,
                [goalId]: { 
                    ...prev[goalId], 
                    isActive: updatedTx.active, 
                    isLoading: false 
                }
            }));

            toast.success(state.isActive 
                ? 'Recurring contribution paused' 
                : 'Recurring contribution resumed');
        } catch (error) {
            console.error('Error toggling recurring status:', error);
            toast.error('Failed to update recurring status');
            setRecurringStates(prev => ({
                ...prev,
                [goalId]: { ...prev[goalId], isLoading: false }
            }));
        }
    };

    const fetchGoals = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            // First get all goals
            const { data: goalsData, error: goalsError } = await supabase
                .from('savings_goals')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (goalsError) throw goalsError;

            // Then get all expenses for these goals
            const { data: expensesData, error: expensesError } = await supabase
                .from('expenses')
                .select('goal_id, amount')
                .in('goal_id', goalsData.map(g => g.id));

            if (expensesError) throw expensesError;

            // Calculate current amount for each goal from expenses
            const goalsWithProgress = goalsData.map(goal => ({
                ...goal,
                current_amount: expensesData
                    .filter(e => e.goal_id === goal.id)
                    .reduce((sum, expense) => sum + expense.amount, 0)
            }));

            setGoals(goalsWithProgress);
            setRecommendations([]); // Set empty recommendations for now
        } catch (error) {
            console.error('Error fetching savings goals:', error);
            toast.error('Failed to load savings goals');
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate estimated completion date based on monthly contribution
    const calculateEstimatedDate = (targetAmount: number, monthlyContribution: number, currentAmount: number = 0) => {
        if (monthlyContribution <= 0) return null;
        const remainingAmount = targetAmount - currentAmount;
        const monthsNeeded = Math.ceil(remainingAmount / monthlyContribution);
        return addMonths(new Date(), monthsNeeded);
    };

    const handleAddGoal = async () => {
        if (!user) return;
        try {
            const monthlyContribution = parseFloat(newGoal.monthly_contribution) || 0;
            const currentDate = new Date();
            const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const formattedDate = firstDayOfMonth.toISOString();
            
            const goalData = {
                ...newGoal,
                target_amount: parseFloat(newGoal.target_amount) || 0,
                monthly_contribution: monthlyContribution,
                user_id: user.id,
                status: 'active',
                created_at: formattedDate
            };

            const { data: goal, error } = await supabase
                .from('savings_goals')
                .insert([goalData])
                .select()
                .single();

            if (error) throw error;

            if (monthlyContribution > 0) {
                // Create a recurring transaction for the monthly contribution
                const { data: recurringTx, error: recurringError } = await supabase
                    .from('recurring_transactions')
                    .insert([{
                        user_id: user.id,
                        name: `Monthly contribution to ${newGoal.name}`,
                        amount: monthlyContribution,
                        type: 'expense',
                        category: newGoal.category,
                        active: true,
                        goal_id: goal.id,
                        frequency: 'monthly',
                        created_at: formattedDate
                    }])
                    .select()
                    .single();

                if (recurringError) throw recurringError;

                // Create the first expense
                await db.expenses.add({
                    user_id: user.id,
                    name: `Contribution to ${newGoal.name}`,
                    amount: monthlyContribution,
                    category: newGoal.category,
                    date: formattedDate,
                    goal_id: goal.id,
                    is_recurring: true,
                    recurring_id: recurringTx.id
                });

                toast.success('Goal created with recurring contribution');
            } else {
                toast.success('Goal created successfully');
            }

            setIsAddingGoal(false);
            setNewGoal({
                name: '',
                target_amount: '',
                monthly_contribution: '1000',
                category: 'investment'
            });
            await fetchGoals();
        } catch (error) {
            console.error('Error adding savings goal:', error);
            toast.error('Failed to add savings goal');
        }
    };

    const handleDeleteGoal = async (deleteRecurring: boolean, deleteExpenses: boolean) => {
        if (!goalToDelete) return;

        try {
            // First get all recurring transactions for this goal
            const { data: recurringTransactions } = await supabase
                .from('recurring_transactions')
                .select('id')
                .eq('goal_id', goalToDelete.id)
                .eq('active', true);

            if (recurringTransactions && recurringTransactions.length > 0) {
                // First update expenses to remove recurring_id references
                const { error: expensesUpdateError } = await supabase
                    .from('expenses')
                    .update({ recurring_id: null, is_recurring: false })
                    .in('recurring_id', recurringTransactions.map(rt => rt.id));

                if (expensesUpdateError) throw expensesUpdateError;

                // Then handle recurring transactions
                if (deleteRecurring) {
                    // Delete the recurring transactions
                    const { error: recurringDeleteError } = await supabase
                        .from('recurring_transactions')
                        .delete()
                        .eq('goal_id', goalToDelete.id);

                    if (recurringDeleteError) throw recurringDeleteError;
                } else {
                    // Nullify goal_id reference in recurring transactions
                    const { error: recurringError } = await supabase
                        .from('recurring_transactions')
                        .update({ goal_id: null })
                        .eq('goal_id', goalToDelete.id);

                    if (recurringError) throw recurringError;
                }
            }

            // Handle expenses
            const { data: expenses } = await supabase
                .from('expenses')
                .select('id')
                .eq('goal_id', goalToDelete.id);

            if (expenses && expenses.length > 0) {
                if (deleteExpenses) {
                    // Delete the expenses
                    const { error: expensesDeleteError } = await supabase
                        .from('expenses')
                        .delete()
                        .eq('goal_id', goalToDelete.id);

                    if (expensesDeleteError) throw expensesDeleteError;
                } else {
                    // Nullify goal_id reference in expenses
                    const { error: expensesError } = await supabase
                        .from('expenses')
                        .update({ goal_id: null })
                        .eq('goal_id', goalToDelete.id);

                    if (expensesError) throw expensesError;
                }
            }

            // Finally, delete the goal itself
            const { error: goalDeleteError } = await supabase
                .from('savings_goals')
                .delete()
                .eq('id', goalToDelete.id);

            if (goalDeleteError) throw goalDeleteError;

            await fetchGoals();
            toast.success('Goal deleted successfully');
        } catch (error) {
            console.error('Error deleting goal:', error);
            throw error; // Re-throw to be handled by the modal
        }
    };

    const handleContribute = (goal: SavingsGoal) => {
        setSelectedGoal(goal);
        setIsContributing(true);
    };

    const calculateProgress = (goal: SavingsGoal) => {
        return (goal.current_amount / goal.target_amount) * 100;
    };

    const handleDeleteClick = (goal: SavingsGoal) => {
        setGoalToDelete(goal);
    };

    const handleGoalClick = (goal: SavingsGoal) => {
        setSelectedGoalForAnalytics(goal);
    };

    const modal = isAddingGoal && (
        <>
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full overflow-hidden my-auto">
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-200">Add New Goal</h2>
                        <button
                            onClick={() => setIsAddingGoal(false)}
                            className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleAddGoal(); }} className="p-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
                        <div className="space-y-5">
                            <div className="bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg p-2 mb-4">
                                <div className="flex items-center gap-1.5">
                                    <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                    <p className="text-xs text-blue-700 dark:text-blue-300">
                                        On creation of the goal, a recurring transaction will be created automatically for the monthly contribution amount.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Goal Name</label>
                                <input
                                    type="text"
                                    value={newGoal.name}
                                    onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                                    className="block w-full rounded-lg border-0 px-3 py-2.5 text-gray-900 dark:text-white bg-white dark:bg-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500 focus:outline-none sm:text-sm sm:leading-6"
                                    placeholder="e.g., House Down Payment"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Amount</label>
                                <div className="relative rounded-lg shadow-sm">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm">₹</span>
                                    </div>
                                    <input
                                        type="number"
                                        value={newGoal.target_amount}
                                        onChange={(e) => {
                                            const targetAmount = e.target.value;
                                            const numericValue = parseFloat(targetAmount) || 0;
                                            // Set monthly contribution to either 1000 or 10% of target amount, whichever is smaller
                                            const suggestedMonthly = Math.min(1000, numericValue * 0.1).toString();
                                            setNewGoal({ 
                                                ...newGoal, 
                                                target_amount: targetAmount,
                                                monthly_contribution: numericValue > 0 ? suggestedMonthly : '1000'
                                            });
                                        }}
                                        className="block w-full rounded-lg border-0 py-2.5 pl-7 pr-12 text-gray-900 dark:text-white bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500 focus:outline-none sm:text-sm sm:leading-6"
                                        placeholder="0.00"
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm">INR</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Contribution</label>
                                <div className="space-y-4">
                                    <div className="relative rounded-lg shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <span className="text-gray-500 dark:text-gray-400 sm:text-sm">₹</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={newGoal.monthly_contribution}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                const numericValue = parseFloat(value) || 0;
                                                const targetValue = parseFloat(newGoal.target_amount) || 0;
                                                if (targetValue > 0) {
                                                    setNewGoal({ 
                                                        ...newGoal, 
                                                        monthly_contribution: Math.min(numericValue, targetValue).toString()
                                                    });
                                                } else {
                                                    setNewGoal({ ...newGoal, monthly_contribution: value });
                                                }
                                            }}
                                            className="block w-full rounded-lg border-0 py-2.5 pl-7 pr-12 text-gray-900 dark:text-white bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 dark:focus:ring-blue-500 focus:outline-none sm:text-sm sm:leading-6"
                                            placeholder="0.00"
                                            required
                                            min="0"
                                            max={parseFloat(newGoal.target_amount) || undefined}
                                            step="100"
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                            <span className="text-gray-500 dark:text-gray-400 sm:text-sm">INR</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max={parseFloat(newGoal.target_amount) || 10000}
                                            step="100"
                                            value={parseFloat(newGoal.monthly_contribution) || 0}
                                            onChange={(e) => setNewGoal({ 
                                                ...newGoal, 
                                                monthly_contribution: e.target.value 
                                            })}
                                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                                            disabled={!parseFloat(newGoal.target_amount)}
                                        />
                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                            <span>₹0</span>
                                            <span>₹{formatIndianNumber(parseFloat(newGoal.target_amount) || 10000).replace('₹', '')}</span>
                                        </div>
                                    </div>
                                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        {parseFloat(newGoal.target_amount) > 0 ? (
                                            parseFloat(newGoal.monthly_contribution) > 0 ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Info size={16} className="text-blue-600 dark:text-blue-400" />
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                                                            Goal Completion
                                                        </p>
                                                    </div>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        At {formatIndianNumber(parseFloat(newGoal.monthly_contribution))} per month, you'll reach your goal by{' '}
                                                        <span className="font-medium text-blue-600 dark:text-blue-400">
                                                            {format(calculateEstimatedDate(
                                                                parseFloat(newGoal.target_amount), 
                                                                parseFloat(newGoal.monthly_contribution)
                                                            )!, 'MMMM yyyy')}
                                                        </span>
                                                        {' '}
                                                        <span className="text-gray-500 dark:text-gray-400">
                                                            ({calculateTimeRemaining(
                                                                parseFloat(newGoal.target_amount), 
                                                                parseFloat(newGoal.monthly_contribution)
                                                            )})
                                                        </span>
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    Set a monthly contribution to see when you'll reach your goal
                                                </p>
                                            )
                                        ) : (
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Set a target amount first to adjust your monthly contribution
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {CATEGORIES.map((category) => (
                                        <button
                                            key={category}
                                            type="button"
                                            onClick={() => setNewGoal(prev => ({ ...prev, category }))}
                                            className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm hover:shadow ring-1 ring-inset ${
                                                newGoal.category === category
                                                    ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 ring-blue-600/20 dark:ring-blue-400/20 shadow-blue-100 dark:shadow-blue-900/50'
                                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 ring-gray-300 dark:ring-gray-600'
                                            }`}
                                        >
                                            {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsAddingGoal(false)}
                                className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors"
                            >
                                Add Goal
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 py-4">
            {isLoading && (
                <>
                    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40"></div>
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 text-center bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">
                            <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-blue-600 dark:bg-blue-500 animate-loading-bar"></div>
                            </div>
                            <p className="text-base text-gray-600 dark:text-gray-400">Loading goals</p>
                        </div>
                    </div>
                </>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-200 text-center sm:text-left">Savings Goals</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                        Track and achieve your financial goals
                    </p>
                </div>
                <button
                    onClick={() => setIsAddingGoal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
                >
                    <Plus size={20} />
                    <span>Add Goal</span>
                </button>
            </div>

            {modal && createPortal(modal, document.body)}

            {selectedGoal && (
                <ContributionModal
                    isOpen={isContributing}
                    onClose={() => {
                        setIsContributing(false);
                        setSelectedGoal(null);
                        fetchGoals(); // Refresh goals after contribution
                    }}
                    goal={selectedGoal}
                />
            )}

            {goalToDelete && (
                <DeleteConfirmationModal
                    isOpen={true}
                    onClose={() => setGoalToDelete(null)}
                    goal={goalToDelete}
                    onConfirm={handleDeleteGoal}
                />
            )}

            {selectedGoalForAnalytics && (
                <GoalAnalyticsModal
                    isOpen={true}
                    onClose={() => setSelectedGoalForAnalytics(null)}
                    goal={selectedGoalForAnalytics}
                />
            )}

            {!isLoading && goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4">
                        <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200 mb-2">
                        No savings goals yet
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
                        Start your financial journey by creating a savings goal. Track your progress and stay motivated to reach your financial targets.
                    </p>
                    <button
                        onClick={() => setIsAddingGoal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
                    >
                        <Plus size={20} />
                        <span>Create New Goal</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goals.map((goal) => (
                        <div
                            key={goal.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div 
                                    className="cursor-pointer hover:opacity-75 transition-opacity"
                                    onClick={() => handleGoalClick(goal)}
                                >
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">{goal.name}</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {calculateEstimatedDate(goal.target_amount, goal.monthly_contribution, goal.current_amount)
                                            ? `Estimated achievement by: ${format(calculateEstimatedDate(goal.target_amount, goal.monthly_contribution, goal.current_amount)!, 'MMMM yyyy')}`
                                            : 'Set monthly contribution'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleContribute(goal);
                                        }}
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200"
                                        title="Add contribution"
                                    >
                                        <PlusCircle size={20} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(goal);
                                        }}
                                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors duration-200"
                                        title="Delete goal"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div 
                                    className="cursor-pointer"
                                    onClick={() => handleGoalClick(goal)}
                                >
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-gray-600 dark:text-gray-400">Progress</span>
                                        <span className="text-gray-900 dark:text-gray-200">{formatIndianNumber(goal.current_amount)} / {formatIndianNumber(goal.target_amount)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(calculateProgress(goal), 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm">
                                    <Target size={16} className="text-blue-600 dark:text-blue-400" />
                                    <span className="text-gray-700 dark:text-gray-300">Monthly: {formatIndianNumber(goal.monthly_contribution)}</span>
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRecurringToggle(goal.id);
                                            }}
                                            disabled={!recurringStates[goal.id]?.hasRecurring || recurringStates[goal.id]?.isLoading}
                                            className={`p-1 rounded-full transition-colors ${
                                                recurringStates[goal.id]?.hasRecurring
                                                    ? recurringStates[goal.id]?.isActive
                                                        ? 'text-green-500 hover:text-yellow-500 dark:text-green-400 dark:hover:text-yellow-400'
                                                        : 'text-yellow-500 hover:text-green-500 dark:text-yellow-400 dark:hover:text-green-400'
                                                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                            }`}
                                            title={
                                                recurringStates[goal.id]?.hasRecurring
                                                    ? recurringStates[goal.id]?.isActive
                                                        ? 'Pause recurring contribution'
                                                        : 'Resume recurring contribution'
                                                    : 'Recurring contribution not set up'
                                            }
                                        >
                                            {recurringStates[goal.id]?.isLoading ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : recurringStates[goal.id]?.isActive ? (
                                                <Pause size={16} />
                                            ) : (
                                                <Play size={16} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 