# PyViz: Python Subset Language Documentation

## Overview of PyViz

PyViz is a subset of Python designed for the sole purpose of learning fundamental programming algorithms. The Code Visualizer guides students through searching and sorting algorithms through the use of its step by step interpreter design, and PyViz is purposefully restrictive for this reason. PyViz includes essential features like functions, loops, and control flow while excluding more advanced features like calsses, decorators, and exception handling.

## Basic Syntax

### Comments

```python
# This is a single-line comment
```

### Indendation

PyViz, much like Python, uses indentation to define code blocks. Convention is to use 4 spaces per indentation level.

```python
if x > 0:
    print("Positive") # This is an indented block
```

## Variables and Data Types

### Variable Assignment

Variables are created when you assign a value to them. Declarations without assignments are not permissable.

```python
x = 5
name = "Robert"
active = True
price = 19.21
```

### Supported Data Types

- **Int**: Whole Numbers (42, -21, 0)
- **Float**: Decimal Numbers (3.14, -0.23, 2.0)
- **String**: Text ("Hello", "World!")
- **Bool**: True or False
- **List**: Ordered, contigious collections of elements in virtual memory. ([1,2,3], ["a", "b", "c"])
- **None**: Represents absence of value

## Output

### f-strings

PyViz allows you to embed variable names and/or complex expressions inside string literals, using curly braces `{}`.

```python
name = "Alice"
age = 30
print(f"Hello, {name}. You are {age - 12} years old.")
```

## Operators

There are three types of operators in PyViz:

### Arithmetic Operators

- Addition `+`
- Subtraction `-`
- Multiplication `*`
- Division `/`
- Integer/Floor Division `//`
- Modulous `%`
- Exponentiation `**`

### Comparison Operators

- Equal to `==`
- Not equal to `!=`
- Less than `<`
- Greater than `>`
- Less than or equal `<=`
- Greater than or equal `>=`

### Logical Operators

- Logical AND `and`
- Logical OR `or`
- Logical NOT `not`

### Assignment Operators

- Assignment `=`
- Addition Assignment `+=`
- Subtraction Assignment `-=` 

## Control flow

### If Statements

```python
if condition:
    # block
```

### If-Else Statements

```python
if score >= 60:
    print("Pass")
else:
    print("Fail")
```

### If-Elif-Else Statements

```python
if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
elif score >= 60:
    grade = "D"
else:
    grade = "F"
```

### Nested Conditionals

```python
if is_weekend:
    if weather == "sunny":
        print("Go to the beach")
    else:
        print("Stay home and relax")
else:
    print("Go to work")
```

## Loops 

### While Loops

Executes a block of code repeatedly while a condition is true.

```python
count = 0
while count < 5:
    print(count)
    count = count + 1
```

### For Loops

Iterates over a sequence of elements (list, string, or range).

#### Iterating over a range

```python
for i in range(5):
    print(i)
```

#### Iterating over a list

```python
fruits = ["apple", "banana", "cherry"]
for fruit in fruits:
    print(fruit)
```

#### Iterating over a string

```python
for char in "hello":
    print(char)
```

### Loop Control

#### Break

Exits loop immediately when ran.

```python
for i in range(10):
    if i == 5:
        break
    print(i)
```

#### Continue

Skips rest of the current iteration.

```python
for i in range(10):
    if i == 5:
    continue
    print(i)
```

## Functions

### Function definitions

```python
def function_name(parameter1, parameter2):
    return value
```

### Recursive Functions

Functions can call themselves in PyViz.

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print(factorial(5))
```

### Function Scope

Like many other languages, variables defined inside a function are local to that function.

Global and local scopes coexist.

## Arrays/Lists

### Creating a List

```python
numbers = [1, 2, 3, 4, 5]
names = ["Alice", "Bob", "Charlie"]
empty = []
```

### Accessing Elements in a list

```python
fruits = ["apple", "banana", "cherry"]
print(fruits[0])
print(fruits[2])
print(fruits[-1]) # gets last element
```

### Modifying Elements

```python 
numbers = [1, 2, 3, 4, 5]
numbers[0] = 10
```

### List Slicing

```python
numbers = [0, 1, 2, 3, 4, 5]
print(numbers[1:4])
print(numbers[:3])
print(numbers[3:])
print(numbers[::2])    
```

### List Methods

List methods that are supported through PyViz are...

- list.append(elem) : adds an element to the end of the list
- list.remove(elem) : removes first occurence of the element in the list
- list.pop() : removes and returns element from the end of the list
- list.count(elem) : returns count of occurences of element in the list
- list.sort() : sorts list in place using target languages (Typescript) native sort.
- list.index(elem) : returns index of element in list, returns -1 if not found.
- list.reverse() : reverses order of elements in list.
- list.contains(elem) : returns true if list contains elem, returns false otherwise.

## Built-in Functions

### print()

Outputs values to the console (output window within the CodeLens tool)

```python
print("Hello World!")
print(42)
```

### input()

Reads a line of text from user input.

```python
name = input("Enter your name: ")
```

### len()

Gets length of iterable.

```python
length = len("12345") # returns 5
length_list = len([1,2,3,4]) # returns 4
```

### type()

Returns type of a value.

```python
num_type = type(4) # returns int
string_type = type("hello") # returns str
```

---------------------------------------------------------------------------------------------

## Limitations

The following common Python features are NOT supported in PyViz:

- Classes and Objects: No object-oriented programming
- Exceptions: No try/except/finally blocks
- Generators: No yield statements
- Decorators: No @ syntax for function decoration
- Dictionaries: No key-value pair data structures (use lists instead)
- Sets: No set data type
- Tuples: No immutable sequences (use lists instead)
- Bitwise Operators: No &, |, ^, ~, <<, >>
- Global Keyword: All variables are global or function scoped.
- Lambda Functions: No anonymous functions
- Import Statements: No external modules
- File I/O: No file reading/writing operations
- Context Managers: No with statements
- Async/Await: No asynchronous programming
- Del keyword

---------------------------------------------------------------------------------------------
