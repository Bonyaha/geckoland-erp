// client/src/app/expenses/page.tsx
'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react'
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  ExpenseRecord,
} from '@/state/api'
import { useToast } from '@/hooks/useToast'
import Toast from '@/app/(components)/Toast'

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' ₴'

/** Convert Date → value string for <input type="date"> */
const toDateInputValue = (iso: string) => iso.split('T')[0]

/** Today's date as YYYY-MM-DD */
const todayValue = () => new Date().toISOString().split('T')[0]

// ─── Modal ───────────────────────────────────────────────────────────────────

interface ExpenseModalProps {
  initial?: ExpenseRecord | null
  onClose: () => void
  onSave: (data: {
    category: string
    amount: number
    timestamp: string
  }) => Promise<void>
  isSaving: boolean
}

const ExpenseModal = ({
  initial,
  onClose,
  onSave,
  isSaving,
}: ExpenseModalProps) => {
  const [category, setCategory] = useState(initial?.category ?? '')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [date, setDate] = useState(
    initial ? toDateInputValue(initial.timestamp) : todayValue(),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category.trim() || !amount || !date) return
    await onSave({
      category: category.trim(),
      amount: parseFloat(amount),
      timestamp: new Date(date).toISOString(),
    })
  }

  return (
    <div
      className='fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4'
      onClick={onClose}
    >
      <div
        className='bg-white rounded-xl w-full max-w-md shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
          <h2 className='text-lg font-bold text-gray-900'>
            {initial ? 'Редагувати витрату' : 'Нова витрата'}
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 rounded-full transition-colors'
          >
            <X size={18} className='text-gray-500' />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Витрата <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder='Наприклад: Пакування, Реклама...'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Сума (₴) <span className='text-red-500'>*</span>
            </label>
            <input
              type='number'
              required
              min='0'
              step='0.01'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder='0.00'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Дата <span className='text-red-500'>*</span>
            </label>
            <input
              type='date'
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm'
            />
          </div>

          <div className='flex gap-3 pt-2'>
            <button
              type='submit'
              disabled={isSaving}
              className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm'
            >
              <Save size={16} />
              {isSaving ? 'Збереження...' : 'Зберегти'}
            </button>
            <button
              type='button'
              onClick={onClose}
              className='px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm'
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

interface DeleteModalProps {
  expense: ExpenseRecord
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

const DeleteModal = ({
  expense,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteModalProps) => (
  <div
    className='fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4'
    onClick={onCancel}
  >
    <div
      className='bg-white rounded-xl shadow-2xl w-full max-w-sm p-6'
      onClick={(e) => e.stopPropagation()}
    >
      <div className='flex items-center gap-3 mb-4'>
        <div className='flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0'>
          <AlertTriangle className='w-5 h-5 text-red-600' />
        </div>
        <div>
          <h3 className='text-base font-bold text-gray-900'>
            Видалити витрату?
          </h3>
          <p className='text-sm text-gray-500 mt-0.5'>{expense.category}</p>
        </div>
      </div>
      <p className='text-sm text-gray-600 mb-6'>Цю дію неможливо скасувати.</p>
      <div className='flex gap-3'>
        <button
          onClick={onConfirm}
          disabled={isDeleting}
          className='flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer text-sm'
        >
          <Trash2 size={14} />
          {isDeleting ? 'Видалення...' : 'Видалити'}
        </button>
        <button
          onClick={onCancel}
          className='flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm cursor-pointer'
        >
          Скасувати
        </button>
      </div>
    </div>
  </div>
)

// ─── Page ────────────────────────────────────────────────────────────────────

const ExpensesPage = () => {
  const { toast, showToast, hideToast } = useToast()

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(
    null,
  )
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(
    null,
  )

  // API
  const { data, isLoading, isError } = useGetExpensesQuery()
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation()
  const [updateExpense, { isLoading: isUpdating }] = useUpdateExpenseMutation()
  const [deleteExpense, { isLoading: isDeleting }] = useDeleteExpenseMutation()

  const expenses = data?.data ?? []

  // ── Computed totals ──
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  // ── Handlers ──
  const handleCreate = async (input: {
    category: string
    amount: number
    timestamp: string
  }) => {
    try {
      await createExpense(input).unwrap()
      showToast('Витрату додано', 'success')
      setShowAddModal(false)
    } catch {
      showToast('Помилка при додаванні витрати', 'error')
    }
  }

  const handleUpdate = async (input: {
    category: string
    amount: number
    timestamp: string
  }) => {
    if (!editingExpense) return
    try {
      await updateExpense({
        expenseId: editingExpense.expenseId,
        updates: input,
      }).unwrap()
      showToast('Витрату оновлено', 'success')
      setEditingExpense(null)
    } catch {
      showToast('Помилка при оновленні витрати', 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return
    try {
      await deleteExpense(deletingExpense.expenseId).unwrap()
      showToast('Витрату видалено', 'success')
      setDeletingExpense(null)
    } catch {
      showToast('Помилка при видаленні витрати', 'error')
    }
  }

  // ── Render ──
  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600' />
      </div>
    )
  }

  if (isError) {
    return (
      <div className='text-center text-red-500 py-10'>
        Помилка завантаження витрат
      </div>
    )
  }

  return (
    <div className='p-6 bg-gray-50 min-h-screen'>
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* Header */}
      <div className='mb-6 flex items-start justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 mb-1'>Витрати</h1>
          <p className='text-gray-500 text-sm'>
            Всього записів: {expenses.length} &nbsp;·&nbsp; Загальна сума:{' '}
            <span className='font-semibold text-gray-700'>
              {formatCurrency(totalAmount)}
            </span>
          </p>
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className='flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors cursor-pointer text-sm shadow-sm'
        >
          <Plus size={16} />
          Додати витрату
        </button>
      </div>

      {/* Table */}
      <div className='bg-white rounded-xl shadow-sm overflow-hidden'>
        <table className='min-w-full'>
          <thead className='bg-gray-50 border-b border-gray-200'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>
                Дата
              </th>
              <th className='px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider'>
                Витрата
              </th>
              <th className='px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider'>
                Сума
              </th>
              <th className='px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider'>
                Дії
              </th>
            </tr>
          </thead>

          <tbody className='divide-y divide-gray-100'>
            {expenses.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className='px-6 py-12 text-center text-gray-400'
                >
                  Витрат ще немає. Натисніть «Додати витрату», щоб почати.
                </td>
              </tr>
            ) : (
              expenses.map((expense) => (
                <tr
                  key={expense.expenseId}
                  className='hover:bg-gray-50 transition-colors'
                >
                  {/* Дата */}
                  <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-600'>
                    {formatDate(expense.timestamp)}
                  </td>

                  {/* Витрата */}
                  <td className='px-6 py-4 text-sm font-medium text-gray-900'>
                    {expense.category}
                  </td>

                  {/* Сума */}
                  <td className='px-6 py-4 text-right whitespace-nowrap text-sm font-bold text-gray-900'>
                    {formatCurrency(expense.amount)}
                  </td>

                  {/* Дії */}
                  <td className='px-6 py-4 text-right whitespace-nowrap'>
                    <div className='flex items-center justify-end gap-2'>
                      <button
                        onClick={() => setEditingExpense(expense)}
                        className='p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer'
                        title='Редагувати'
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeletingExpense(expense)}
                        className='p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer'
                        title='Видалити'
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Footer total row */}
          {expenses.length > 0 && (
            <tfoot className='bg-gray-50 border-t border-gray-200'>
              <tr>
                <td
                  colSpan={2}
                  className='px-6 py-3 text-sm font-semibold text-gray-700'
                >
                  Разом
                </td>
                <td className='px-6 py-3 text-right text-sm font-bold text-gray-900'>
                  {formatCurrency(totalAmount)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <ExpenseModal
          onClose={() => setShowAddModal(false)}
          onSave={handleCreate}
          isSaving={isCreating}
        />
      )}

      {/* Edit Modal */}
      {editingExpense && (
        <ExpenseModal
          initial={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={handleUpdate}
          isSaving={isUpdating}
        />
      )}

      {/* Delete Confirm Modal */}
      {deletingExpense && (
        <DeleteModal
          expense={deletingExpense}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingExpense(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}

export default ExpensesPage
