import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const OPTION_HEIGHT = 40 // 터치하기 쉬운 높이 (CSS .count-dropdown__option 과 같게 유지)
const LIST_PADDING = 8
const MAX_LIST_HEIGHT = 240
const PAGE_SIZE = 5
const TYPEAHEAD_RESET_MS = 700

/**
 * 표시 순서 (HTML 순서 = 화면 순서, 방향키도 화면 방향과 같다)
 * - 아래로 열림: 위에서 아래로 0, 1, 2, … upper
 * - 위로 열림:   위에서 아래로 upper, … 2, 1, 0 → 선택창 바로 위가 0, 선택창에서 멀어질수록 커진다
 */
function buildOptions(upper, placement) {
  const ascending = Array.from({ length: upper + 1 }, (_, count) => count)
  return placement === 'top' ? ascending.reverse() : ascending
}

/**
 * 인원 선택 드롭다운 (WAI-ARIA "Select-Only Combobox" 방식, 외부 라이브러리 없음)
 *
 * <ul>
 *   <li>아래 공간이 부족하고 위가 더 넓으면 위로 연다. 스크롤·창 크기 변경·바깥 클릭 시 닫는다.</li>
 *   <li>닫힘: Enter·Space·↑·↓(Alt+↓ 포함)는 목록만 연다(값 유지). 숫자 키는 목록을 열고 해당 인원으로 이동.</li>
 *   <li>열림: ↑↓ 화면 방향으로 한 칸, Home/End 화면 맨 위/맨 아래, PageUp/PageDown 5칸(끝에서 순환 없음),
 *       Enter·Space 선택, Tab 선택 후 다음 칸, Esc 값 유지하고 닫기.</li>
 *   <li>포커스는 항상 선택창(버튼)에 있고, 강조 항목은 aria-activedescendant 로 알린다.</li>
 * </ul>
 */
export default function CountDropdown({ id, labelId, value, max, onChange, disabled, invalid, describedBy, unit = '명' }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('bottom')
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)
  const listRef = useRef(null)
  const typeahead = useRef({ text: '', timer: null })

  const listId = `${id}-listbox`
  const optionId = (count) => `${id}-option-${count}`
  const upper = Math.max(max, value) // 현재 값이 최대값을 넘으면 목록에 남겨 오류로 안내한다
  const options = buildOptions(upper, placement)

  function openList(targetValue = value) {
    const rect = buttonRef.current.getBoundingClientRect()
    const listHeight = Math.min((upper + 1) * OPTION_HEIGHT + LIST_PADDING, MAX_LIST_HEIGHT)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const nextPlacement = spaceBelow < listHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
    const nextOptions = buildOptions(upper, nextPlacement)
    setPlacement(nextPlacement)
    setActiveIndex(Math.max(0, nextOptions.indexOf(targetValue)))
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function select(index) {
    if (index >= 0 && index < options.length) onChange(options[index])
    close()
    buttonRef.current?.focus()
  }

  function move(delta) {
    setActiveIndex((current) => Math.min(options.length - 1, Math.max(0, current + delta)))
  }

  /** 숫자 키를 이어서 누르면(700ms 안) 두 자리 인원으로 이동한다. 없는 숫자면 마지막 숫자만 본다. */
  function handleDigit(digit) {
    const state = typeahead.current
    clearTimeout(state.timer)
    state.text += digit
    state.timer = setTimeout(() => {
      state.text = ''
    }, TYPEAHEAD_RESET_MS)
    let target = Number(state.text)
    if (target > upper) {
      state.text = digit
      target = Number(digit)
    }
    if (target > upper) return
    if (open) setActiveIndex(options.indexOf(target))
    else openList(target)
  }

  function handleKeyDown(event) {
    if (disabled) return
    const { key } = event
    if (/^[0-9]$/.test(key)) {
      event.preventDefault()
      handleDigit(key)
      return
    }
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(key)) {
        event.preventDefault()
        openList()
      }
      return
    }
    switch (key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'PageDown':
        event.preventDefault()
        move(PAGE_SIZE)
        break
      case 'PageUp':
        event.preventDefault()
        move(-PAGE_SIZE)
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        select(activeIndex)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        // 선택하고 닫은 뒤, 기본 동작대로 다음 칸으로 이동한다.
        if (activeIndex >= 0) onChange(options[activeIndex])
        close()
        break
      default:
    }
  }

  // 열 때 시작 위치: 어느 방향이든 선택창 쪽 끝(0명)부터 보이게 한다. 위로 열리면 맨 아래, 아래로 열리면 맨 위.
  useLayoutEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = placement === 'top' ? listRef.current.scrollHeight : 0
  }, [open, placement])

  // 강조 항목이 목록 안에서 보이도록 목록만 스크롤한다. (페이지는 스크롤하지 않음)
  useLayoutEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return
    const list = listRef.current
    const option = list.children[activeIndex]
    if (!option) return
    if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop
    } else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
    }
  }, [open, activeIndex, placement])

  // 바깥 클릭, 페이지 스크롤, 창 크기 변경 시 닫는다. (목록 자체 스크롤은 제외)
  useEffect(() => {
    if (!open) return undefined
    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) close()
    }
    function handleScroll(event) {
      if (event.target !== listRef.current) close()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  useEffect(() => () => clearTimeout(typeahead.current.timer), [])

  return (
    <div className="count-dropdown" ref={wrapperRef}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        className="input count-dropdown__button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${id}`}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(options[activeIndex]) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={(event) => {
          // 키보드(Enter·Space)로 생긴 클릭은 keydown 에서 이미 처리했으므로 무시한다.
          if (event.detail === 0) return
          if (open) close()
          else openList()
        }}
        onKeyDown={handleKeyDown}
      >
        <span>
          {value}
          {unit}
        </span>
        <span className="count-dropdown__chevron" aria-hidden="true">
          {open && placement === 'top' ? '▴' : '▾'}
        </span>
      </button>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        className={`count-dropdown__list count-dropdown__list--${placement}`}
        hidden={!open}
      >
        {options.map((count, index) => (
          <li
            key={count}
            id={optionId(count)}
            role="option"
            aria-selected={count === value}
            data-value={count}
            className={`count-dropdown__option${index === activeIndex ? ' count-dropdown__option--active' : ''}`}
            onMouseDown={(event) => event.preventDefault()} // 포커스를 선택창에 유지
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => select(index)}
          >
            {count}
            {unit}
          </li>
        ))}
      </ul>
    </div>
  )
}
