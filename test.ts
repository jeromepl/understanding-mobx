import { observable, computed, autorun, transaction } from "./src/mobx";


class Test {
    @observable test1 = 'Message';
    @observable test2 = 3;

    @computed get test3() {
        return `${this.test1} ${this.test2}`;
    }
}

const testObj = new Test();

console.log("Setup Autorun");
autorun(() => { // Should trigger initially
    console.log("Autorun triggered");
    if (testObj.test1 === "Hello") {
        console.log(`> ${testObj.test3}`);
    }
});

console.log("testObj.test2 = 5;");
testObj.test2 = 5; // Should NOT trigger autorun
console.log("testObj.test1 = 'Hello';");
testObj.test1 = 'Hello'; // Should trigger autorun
console.log("testObj.test2 = 42;")
testObj.test2 = 42; // Should trigger autorun

// Test transactions
console.log("Running transaction");
transaction(() => { // Should trigger autorun only once after the whole function has executed
    console.log("testObj.test1 = 'Thing';");
    testObj.test1 = 'Thing';
    console.log("testObj.test1 = 'Stuff';");
    testObj.test1 = 'Stuff';
});
