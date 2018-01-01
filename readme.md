# Understanding MobX

I have seen time and time again on the web people saying that they dislike the *magic* of how [MobX](https://mobx.js.org/) works, especially when compared to very explicit state management libraries like Redux.

This project's goal was to demystify the inner workings of MobX by providing a minimal implementation (~200 lines), thus making it more approachable.

For this reason, the functionality contained here was kept to a minimum. Only the following API was implemented:
- **@observable** - only works on primitive values (no arrays or objects)
- **@computed**
- **transaction(fn: () => void)**
- **autorun(fn: () => void)**

Table Of Contents:
- [How MobX Works](#how-mobx-works)
    - [Observables](#observables)
    - [Derivations](#derivations)
    - [Computed Values](#computed-values)
- [Implementation Challenges](#implementation-challenges)
    - [Knowing (at Runtime) Which Derivations Are Affected by Which Observables](#knowing-at-runtime-which-derivations-are-affected-by-which-observables)
    - [Making Sure Derivations Run Once Per Update and In the Right Order](#making-sure-derivations-run-once-per-update-and-in-the-right-order)
- [Final touches](#final-touches)
    - [Transactions](#transactions)

## How MobX Works

> *Note*: most of the information here was taken from a [post](https://medium.com/@mweststrate/becoming-fully-reactive-an-in-depth-explanation-of-mobservable-55995262a254) by Michel Weststrate, the creator of MobX.

Let's start with a very simple dependency structure to better understand the different concepts within MobX before we get into te implementation.

![Dependency Tree](/img/dependency_tree.png)

In your typical application using MobX, you will have a state made of multiple **observables**, marked in blue in the above image. On top of those, **computed values** can be used to automatically derive state properties from other observables (marked in green). Finally, **reactions** are what is driven by the state: usually something driving the rendering of the HTML of the page like the `render()` method of React.

Since computed values and reactions are both driven by observables, they can be grouped and referred to as **derivations**.

For example, using the dependency structure in the above diagram, if the value of the observable *A* were to change, the computed value *C* would update, which would in turn (assuming that the value of C was changed) update the computed value *D* and finally the reaction *E*.

### Observables

The basic idea behind observables is that they keep track of the derivations that they affect so that everytime their value changes, they can update those derivations as well.

The way this is implemented in the `@observable` decorator is by replacing the decorated class property by a getter and a setter. The setter can then be used to detect whether the value has changed and to update the derivations that are affected by this observable.

In this code, they are implemented as simple objects of `type Observable = { val: any, derivations: Set<Derivation> }`.

### Derivations

Derivations are fairly simple, they keep a reference to a function to be run when one the observables that affect them change value. They are implemented as a `Derivation` class.

### Computed Values

As mentionned earlier, computed values are derivations. However, since they affect other derivations, they behave in the same way as observables. Thus, these are implemented as a `Computed` class which extends `Derivation`. Computed contains an additional `observable: Observable` property and the function stored in the Derivation is explicitely defined to be equivalent to the setter of an Observable.

## Implementation Challenges

We now have an understanding of all the objects involved in MobX, but we are still missing a few things.

For example, how do observables know which derivations they affect?

### Knowing (at Runtime) Which Derivations Are Affected by Which Observables

To answer the aforementioned question, the way MobX keeps track of the derivations affected by an observable is really simple, but also extremely clever. It is perhaps also the biggest reason why MobX appears to be doing a lot of *magic* under the hood.

The solution is to, when running a derivation, keep track of all the observables/computed values that are accessed.
This can be easily implemented by adding a bit of code to the getter of observables and to have a variable storing whether a derivation is currently being run or not.
After the derivation has finished running, it checks if the list of accessed observables is different from the previous time it was run and accordingly updates the list of affected derivations in observables.

If an observable is not accessed anymore, the derivation is removed from that observable's list of affected derivations.
On the other hand, a newly accessed observable has that derivation added to its list.

When this entire operation is done **every time** a derivation is ran, we get as a result that affected derivations are dynamically updated.

Take for example the following `autorun` where every property of the `state` is an observable:
```javascript
autorun(() => {
    if (state.a) {
        console.log(state.b);
    }
});
```

Then, using the above technique, if `state.a` evaluates to `false`, then `state.b` will never be accessed and thus this `autorun` will be removed from the list of affected derivations of the `state.b` observable. Changing the value of `state.b` will thus not trigger the `autorun` if `state.a` evaluates to false!

### Making Sure Derivations Run Once Per Update and In the Right Order

The last key to completing this minimalist MobX replica is to ensure that derivations are run 1. In the right order and 2. Only once per observable update.
Let's recall the example dependency tree shown at the start:

![Dependency Tree](/img/dependency_tree.png)

Take a moment to think about what would happen when the observable *B* is updated.
The setter of that observable would trigger an update for all the derivations it directly affects, in this case *C* and *E*.

However, we see that *C* will in turn update *D* which will itself update *E*. This effectively means that the derivation *E* would be run **twice** and that the first time it would run it would use the non-updated value of *D*.

To solve this problem, MobX very ingeniously runs the updates in two steps:
1. Propagate a 'stale' notification through the tree.
2. Starting from the updated observable, send a 'ready' notification to all derivations in the list of affected derivations.

In step 1, derivations count the number of times they receive a 'stale' notification.
Then, in step 2, derivations **only** run once they receive as many 'ready' notifications as they received 'stale' notifications. After a computed value is ran, it in turns sends a 'ready' notification to its list of affected derivation.

This ensures that each derivation is only ran **once** and only **after** all of its dependency have updated!

## Final touches

### Transactions

Transactions are a very important piece of MobX as they allow explicitely grouping changes to the state so that only the strict minimum gets updated, and all at once.

When updating observables inside of a transaction, the list of affected derivations of these observables is joined into a new list. This list is implemented as a `Set` so that there are no duplicate Derivations in there.
Then, once the entire code inside the transaction has finished running, this Set is used as if it was the list of affected derivations inside an updated observable to trigger the same chain of events as described in the rest of this page.
