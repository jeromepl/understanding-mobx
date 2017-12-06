import { observable, computed, autorun, transaction } from "./src/mobx";


class Test {
    @observable test1 = "Message";
    @observable test2 = 3;

    @computed get test3() {
        return `${this.test1} ${this.test2}`;
    }
}

const testObj = new Test();
console.log(testObj.test3);
// autorun(() => {
//     console.log("Autorun triggered"); // Should not trigger if changing test2 and last call test1 was NOT "Hello"
//     if (testObj.test1 === "Hello") {
//         const a = testObj.test2; // Simply access the value for this test
//     }
// });

// // Try some changes and see if it logs output
// testObj.test2 = 100; // Should NOT trigger autorun
// testObj.test1 = "Hello"; // Should trigger autorun
// testObj.test2 = 42; // Should trigger autorun as well

// // Test transactions
// transaction(() => { // Should trigger autorun only once after the whole function has executed
//     testObj.test1 = "Thing";
//     testObj.test1 = "Stuff";
// });
