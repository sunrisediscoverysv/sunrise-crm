import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePipelineStages } from '@/hooks/usePipelineStages'
import { createStage, updateStage, deleteStage, reorderStages } from '@/lib/mutations'
import { Button } from '@/components/Button'
import type { PipelineStage } from '@/types/database'

const PRESET_COLORS = [
  '#03a5af', '#195267', '#114252', '#075865',
  '#eebb69', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#ef4444', '#6b7280',
]

interface StageRowProps {
  stage: PipelineStage
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onSave: (values: { name: string; color: string }) => void
  onDelete: () => void
  isSaving: boolean
}

function StageRow({ stage, isFirst, isLast, onMoveUp, onMoveDown, onSave, onDelete, isSaving }: StageRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name)
  const [color, setColor] = useState(stage.color)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), color })
    setEditing(false)
  }

  function handleCancel() {
    setName(stage.name)
    setColor(stage.color)
    setEditing(false)
    setConfirmDelete(false)
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-card border border-brand-light-gray p-4">
      {/* Reorder controls */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="h-5 w-5 flex items-center justify-center rounded text-brand-charcoal/40 hover:text-brand-dark hover:bg-brand-light-gray disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Subir"
        >
          <svg viewBox="0 0 12 8" className="w-3 h-2 fill-current"><path d="M6 0L0 8h12z"/></svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="h-5 w-5 flex items-center justify-center rounded text-brand-charcoal/40 hover:text-brand-dark hover:bg-brand-light-gray disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Bajar"
        >
          <svg viewBox="0 0 12 8" className="w-3 h-2 fill-current"><path d="M6 8L0 0h12z"/></svg>
        </button>
      </div>

      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white ring-offset-1"
        style={{ backgroundColor: editing ? color : stage.color }}
      />

      {editing ? (
        <div className="flex-1 flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-1.5 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
          />
          {/* Color picker */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
                title={c}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" loading={isSaving} onClick={handleSave} disabled={!name.trim()}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-brand-dark font-sans">{stage.name}</span>
            {(stage.is_won || stage.is_lost) && (
              <span className={`ml-2 text-xs font-sans px-2 py-0.5 rounded-pill ${stage.is_won ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                {stage.is_won ? 'Ganado' : 'Perdido'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Editar
            </Button>
            {confirmDelete ? (
              <>
                <Button size="sm" variant="danger" loading={isSaving} onClick={onDelete}>
                  Confirmar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
                <span className="text-red-500">Eliminar</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface NewStageFormProps {
  nextPosition: number
  onCreated: () => void
}

function NewStageForm({ nextPosition, onCreated }: NewStageFormProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: () => createStage({ name: name.trim(), color, position: nextPosition, is_won: false, is_lost: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] })
      setName('')
      setColor(PRESET_COLORS[0])
      setOpen(false)
      onCreated()
    },
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-card border-2 border-dashed border-brand-light-gray text-brand-charcoal/50 hover:border-brand-teal hover:text-brand-teal transition-colors font-sans text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar etapa
      </button>
    )
  }

  return (
    <div className="bg-white rounded-card border border-brand-teal/40 p-4 flex flex-col gap-3">
      <p className="text-sm font-medium text-brand-dark font-sans">Nueva etapa</p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Nombre de la etapa…"
        className="w-full px-3 py-1.5 text-sm font-sans text-brand-dark border border-brand-light-gray rounded-button focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) create.mutate(); if (e.key === 'Escape') setOpen(false) }}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-6 h-6 rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              outline: color === c ? `2px solid ${c}` : 'none',
              outlineOffset: '2px',
            }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" loading={create.isPending} onClick={() => create.mutate()} disabled={!name.trim()}>
          Crear etapa
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

export function PipelineStagesManager() {
  const queryClient = useQueryClient()
  const { data: stages = [], isLoading } = usePipelineStages()

  const updateStageMut = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name: string; color: string } }) =>
      updateStage(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] }),
  })

  const deleteStageMut = useMutation({
    mutationFn: (id: string) => deleteStage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] }),
  })

  const reorderMut = useMutation({
    mutationFn: (updated: { id: string; position: number }[]) => reorderStages(updated),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-stages'] }),
  })

  function moveStage(index: number, direction: 'up' | 'down') {
    const sorted = [...stages].sort((a, b) => a.position - b.position)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length) return

    const updated = sorted.map((s, i) => {
      if (i === index) return { id: s.id, position: sorted[swapIndex].position }
      if (i === swapIndex) return { id: s.id, position: sorted[index].position }
      return { id: s.id, position: s.position }
    })
    reorderMut.mutate(updated)
  }

  const sorted = [...stages].sort((a, b) => a.position - b.position)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-brand-light-gray rounded-card animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((stage, index) => (
        <StageRow
          key={stage.id}
          stage={stage}
          isFirst={index === 0}
          isLast={index === sorted.length - 1}
          onMoveUp={() => moveStage(index, 'up')}
          onMoveDown={() => moveStage(index, 'down')}
          onSave={values => updateStageMut.mutate({ id: stage.id, values })}
          onDelete={() => deleteStageMut.mutate(stage.id)}
          isSaving={updateStageMut.isPending || deleteStageMut.isPending}
        />
      ))}
      <NewStageForm
        nextPosition={sorted.length > 0 ? sorted[sorted.length - 1].position + 1 : 1}
        onCreated={() => {}}
      />
    </div>
  )
}
